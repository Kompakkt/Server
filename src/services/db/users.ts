// prettier-ignore
import { IUserData, EUserRank, isAnnotation, isPerson, isInstitution } from '../../common/interfaces';
import { ObjectId } from 'mongodb';
import { Request, Response, NextFunction } from 'express';
import { UserCache } from '../cache';
import { Logger } from '../logger';
import { query, areIdsEqual } from './functions';
import { Accounts, Repo } from './controllers';
import { IEntityHeadsUp, isValidCollection, ICollectionParam, PushableEntry } from './definitions';
import Entities from './entities';

const getBySession = (req: Request<any>) => {
  const username = (req as any).session?.passport?.user;
  const sessionID = req.sessionID;
  if (!sessionID || !username) return undefined;
  return Accounts.users.findOne({ sessionID, username });
};

const getByUsername = (username: string) => Accounts.users.findOne({ username });

const getUser = async (req: Request<any> | IUserData) =>
  isUser(req) ? await getByUsername(req.username) : await getBySession(req as Request);

const isUser = (obj: any): obj is IUserData => {
  return obj && !!obj?.username && !!obj?.mail;
};

const login = async (req: Request<any>, res: Response) => {
  const user: IUserData = req.user as IUserData;
  const username = req.body.username.toLowerCase();
  const userdata = await getByUsername(username);

  if (!userdata) return res.status(400).send('User not found');

  const updatedUser: IUserData = {
    ...user,
    sessionID: req.sessionID,
    data: userdata.data ?? {},
    role: userdata.role ?? EUserRank.user,
  };
  delete (updatedUser as any)['_id']; // To prevent Mongo write error

  return Accounts.users
    .updateOne({ username }, { $set: updatedUser }, { upsert: true })
    .then(async () => {
      Logger.log(`User ${updatedUser.username} logged in`);
      res.status(200).send(await resolve(updatedUser));
    })
    .catch(error => {
      Logger.err(error);
      res.status(500).send('Failed updating user entry in database');
    });
};

const logout = async (req: Request<any>, res: Response) => {
  const user = await getBySession(req);
  if (!user) return res.status(400).send('User not found by session');
  const { username, sessionID } = user;
  return Accounts.users.updateOne({ username, sessionID }, { $set: { sessionID: undefined } });
};

const makeOwnerOf = async (req: Request<any> | IUserData, _id: string | ObjectId, coll: string) => {
  const user = await getUser(req);

  if (!ObjectId.isValid(_id) || !user) return false;

  const arr = (user.data[coll] ?? []).filter(_ => _);

  const doesExist = arr.find(id => areIdsEqual(id, _id));
  if (doesExist) return true;

  arr.push(new ObjectId(_id));

  user.data[coll] = arr;
  const updateResult = await Accounts.users.updateOne(query(user._id), {
    $set: { data: user.data },
  });
  if (!updateResult) return false;

  UserCache.del(UserCache.hash(user.username));

  return true;
};

const undoOwnerOf = async (req: Request<any> | IUserData, _id: string | ObjectId, coll: string) => {
  const user = await getUser(req);

  if (!ObjectId.isValid(_id) || !user) return false;

  const arr = (user.data[coll] ?? []).filter(_ => _).filter(id => !areIdsEqual(id, _id));
  user.data[coll] = arr;

  const updateResult = await Accounts.users.updateOne(query(user._id), {
    $set: { data: user.data },
  });
  if (!updateResult) return false;

  UserCache.del(UserCache.hash(user.username));

  return true;
};

// TODO: resolve only specific properties?
// Could take property name or list of properties as argument
const resolve = async (req: Request<any> | IUserData) => {
  const user = await getUser(req);
  if (!user) return false;
  const { username, data } = user;

  // Try to get from cache
  const hash = UserCache.hash(username);
  const cachedUser = await UserCache.get<IUserData>(hash);
  if (cachedUser) return cachedUser;

  // Otherwise fully resolve
  for (const coll in { ...data }) {
    if (!isValidCollection(coll)) continue;
    if (data[coll] === undefined) continue;
    data[coll] = await Promise.all(data[coll]!.map(async obj => Entities.resolve(obj, coll)));
    // Filter possible null's
    data[coll] = data[coll]!.filter(obj => obj && Object.keys(obj).length > 0);
  }

  // Replace new resolved data and update cache
  const updatedUser = { ...user, data };
  UserCache.set(hash, updatedUser);

  return updatedUser;
};

const isOwner = async (req: Request<any> | IUserData, _id: string | ObjectId) => {
  const user = await getUser(req);
  if (!user) return false;
  // TODO: do not need to resolve everything
  // getting any hit is enough.
  const resolvedUser = (await resolve(user)) ?? {};
  return JSON.stringify(resolvedUser).indexOf(_id.toString()) !== -1;
};

const isOwnerMiddleware = async (
  req: Request<any, any, { identifier: string | ObjectId }>,
  _: Response,
  next: NextFunction,
) => {
  return isOwner(req, req.body.identifier) ? next() : next('Not owner of entity');
};

const isAdmin = async (req: Request<any> | IUserData) => {
  const user = await getUser(req);
  return user ? user.role === EUserRank.admin : false;
};

const isAllowedToEdit = async (
  req: Request<ICollectionParam, any, PushableEntry>,
  res: Response<any, IEntityHeadsUp>,
  next: NextFunction,
) => {
  const user = await getBySession(req);
  if (!user) return res.status(404).send('User not found by session');

  const collectionName = req.params.collection;
  if (!isValidCollection(collectionName)) return res.status(400).send('Invalid collection');

  const { _id } = req.body;

  const isValidObjectId = ObjectId.isValid(_id);
  const doesEntityExist = !!(await Repo.get(collectionName)?.findOne(query(_id)));

  /**
   * If the entity already exists we need to check for owner status
   * We skip this for annotations, since annotation ranking can be changed by owner
   * We check this in the saving strategy instead
   * We also skip this for persons and institutions since their nested content
   * (addresses, contact_references, etc.) can also be updated
   */
  const isEditableType = (_e: any) => isAnnotation(_e) || isPerson(_e) || isInstitution(_e);

  const needOwnerCheck = isValidObjectId && doesEntityExist && !isEditableType(req.body);
  if (needOwnerCheck && !(await isOwner(req, _id))) {
    return res.status(401).send('User is not owner');
  }

  res.locals.headsUp = { user, doesEntityExist, isValidObjectId, collectionName };

  return next();
};

const getCurrentUserData = async (req: Request<any>, res: Response) => {
  const user = await resolve(req);
  return user
    ? res.status(200).send(user)
    : res.status(404).send('User not found by sessionID. Try relogging');
};

const validateSession = async (req: Request<any>, _: Response, next: NextFunction) => {
  return next(!!(await getBySession(req)) ? null : 'User not found by session');
};

const getStrippedUsers = async (_: Request<any>, res: Response) => {
  const users = await Accounts.users.findAll();
  return res.status(200).send(
    users.map(user => ({
      username: user.username,
      fullname: `${user.prename} ${user.surname}`,
      _id: user._id,
    })),
  );
};

export const Users = {
  getUser,
  getBySession,
  getByUsername,
  isUser,
  login,
  logout,
  makeOwnerOf,
  undoOwnerOf,
  resolve,
  isOwner,
  isOwnerMiddleware,
  isAdmin,
  isAllowedToEdit,
  getCurrentUserData,
  validateSession,
  getStrippedUsers,
};

export default Users;
