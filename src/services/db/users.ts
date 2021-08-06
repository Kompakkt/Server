// prettier-ignore
import { IUserData, EUserRank, IDocument, isAnnotation, isPerson, isInstitution } from '../../common/interfaces';
import { ObjectId } from 'mongodb';
import { Request, Response, NextFunction } from 'express';
import { UserCache } from '../cache';
import { Logger } from '../logger';
import { query } from './functions';
import { Accounts } from './controllers';
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
  const userData = await getBySession(req);
  console.log('user', user);
  console.log('userData', userData);

  if (!userData) return res.status(400).send('User not found by session');

  const updatedUser: IUserData = {
    ...user,
    username,
    sessionID: userData.sessionID,
    data: userData.data ?? {},
    role: userData.role ?? EUserRank.user,
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

  user.data[coll] = user.data[coll] ?? [];

  const doesExist = user.data[coll]
    .filter(obj => obj)
    .find((obj: any) => obj.toString() === _id.toString());

  if (doesExist) return true;

  user.data[coll].push(new ObjectId(_id));
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

  user.data[coll] = user.data[coll] ?? [];
  user.data[coll] = user.data[coll].filter(id => id !== _id);

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
  for (const property in { ...data }) {
    data[property] = await Promise.all(
      data[property].map(async obj => Entities.resolve(obj, property)),
    );
    // Filter possible null's
    data[property] = data[property].filter(obj => obj && Object.keys(obj).length > 0);
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

const isAllowedToEdit = async (req: Request<any>, res: Response, next: NextFunction) => {
  const user = await getBySession(req);
  if (!user) return res.status(404).send('User not found by session');

  const collectionName = req.params.collection.toLowerCase();
  const entity = req.body as IDocument;

  const isValidObjectId = ObjectId.isValid(entity._id);
  const doesEntityExist = !!(await Entities.resolve(entity, collectionName, 0));

  /**
   * If the entity already exists we need to check for owner status
   * We skip this for annotations, since annotation ranking can be changed by owner
   * We check this in the saving strategy instead
   * We also skip this for persons and institutions since their nested content
   * (addresses, contact_references, etc.) can also be updated
   */
  const isEditableType = (_e: any) => isAnnotation(_e) || isPerson(_e) || isInstitution(_e);

  const needOwnerCheck = isValidObjectId && doesEntityExist && !isEditableType(entity);
  if (needOwnerCheck && !(await isOwner(req, entity._id))) {
    return res.status(401).send('User is not owner');
  }

  // TODO: As Interface
  (req as any).data = {
    userData: user,
    doesEntityExist,
    isValidObjectId,
    collectionName,
  };

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