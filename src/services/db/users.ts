// prettier-ignore
import { randomBytes } from 'crypto';
import { ObjectId } from 'mongodb';
import { Request, Response, NextFunction } from 'express';
import { IUserData, UserRank, isAnnotation, isPerson, isInstitution } from '../../common';
import { UserCache } from '../cache';
import { Logger } from '../logger';
import { Mailer } from '../mailer';
import { query, areIdsEqual, getEmptyUserData } from './functions';
import { updateUserPassword } from '../express';
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
  const user = req.user as IUserData & { strategy?: string };
  const username = req.body.username;
  let userdata = await getByUsername(username);

  // Abort if user has no saved data and no strategy was given
  if (!userdata && !user.strategy) return res.status(400).send('User not found');

  // Strategy specific checks
  // LDAP users will have no data saved on first login, so we take the request data instead
  if (!userdata && user.strategy === 'ldap') userdata = user;

  // At the end of strategy checks, abort if we still don't have any user data available
  if (!userdata) return res.status(400).send('User not found');

  const updatedUser: IUserData = {
    ...user,
    sessionID: req.sessionID,
    data: { ...getEmptyUserData(), ...userdata.data },
    role: userdata.role ?? UserRank.user,
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
  return Accounts.users
    .updateOne({ username, sessionID }, { $set: { sessionID: undefined } })
    .then(updateResult => {
      return res
        .status(!!updateResult ? 200 : 400)
        .send(!!updateResult ? 'Logged out' : 'Failed logging out');
    });
};

const requestPasswordReset = async (req: Request<any>, res: Response) => {
  const { username } = req.body as { username: string };

  const user = await Accounts.users.findOne({ username });
  if (!user) return res.status(400).send('User not found');

  const resetToken = randomBytes(32).toString('hex');
  const tokenExpiration = Date.now() + 86400000; // 24 hours

  const updateResult = await Accounts.users.updateOne(query(user._id), {
    $set: { resetToken, tokenExpiration },
  });
  if (!updateResult) return res.status(500).send('Failed requesting a password reset');

  const text = `
Somebody (hopefully you) requested to reset your Kompakkt account password.

If this was not requested by you, you can ignore this mail.
To reset your password, follow this link and choose a new password:
https://kompakkt.de/?action=passwordreset&token=${resetToken}

This link is only valid for 24 hours`.trim();

  const success = await Mailer.sendMail({
    from: 'noreply@kompakkt.de',
    to: user.mail,
    subject: 'Kompakkt password reset request',
    text,
  })
    .then(() => true)
    .catch(err => {
      Logger.err(err);
      return false;
    });
  if (!success) return res.status(500).send('Failed sending password reset mail');

  return res.status(200).send('Your password reset has been requested');
};

const confirmPasswordResetRequest = async (req: Request<any>, res: Response) => {
  const { username, token, password } = req.body as {
    username: string;
    token: string;
    password: string;
  };

  const user = await Accounts.users.findOne({ username });
  if (!user) return res.status(400).send('User not found');

  // TODO: add resetToken & tokenExpiration to IUserData or use a different collection
  const { resetToken, tokenExpiration } = user as unknown as {
    resetToken: string;
    tokenExpiration: number;
  };

  if (tokenExpiration < Date.now() || resetToken !== token)
    return res.status(500).send('Incorrect or expired reset token given');
  const success = await updateUserPassword(user.username, password);

  if (!success) return res.status(500).send('Failed updating password');

  return res.status(200).send('Your password has been successfully reset');
};

const forgotUsername = async (req: Request<any>, res: Response) => {
  const { mail } = req.body as { mail: string };

  const user = await Accounts.users.findOne({ mail });
  if (!user) return res.status(400).send('User not found');

  const success = await Mailer.sendMail({
    from: 'noreply@kompakkt.de',
    to: user.mail,
    subject: 'Your Kompakkt username',
    text: `
You seem to have forgotten your Kompakkt username, but no worries, we still know it!
Your username is:
${user.username}

Head back to
https://kompakkt.de/?action=login&username=${user.username}
and log in!`,
  })
    .then(() => true)
    .catch(err => {
      Logger.err(err);
      return false;
    });
  if (!success) return res.status(500).send('Failed sending username mail');

  return res.status(200).send('Your username has been sent via mail');
};

const makeOwnerOf = async (req: Request<any> | IUserData, _id: string | ObjectId, coll: string) => {
  const user = await getUser(req);

  if (!ObjectId.isValid(_id) || !user) return false;
  if (!isValidCollection(coll)) return false;

  const arr = user.data[coll].filter(_ => _);

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
  if (!isValidCollection(coll)) return false;

  const arr = user.data[coll].filter(_ => _).filter(id => !areIdsEqual(id, _id));
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
  return (await isOwner(req, req.body.identifier)) ? next() : next('Not owner of entity');
};

const isAdmin = async (req: Request<any> | IUserData) => {
  const user = await getUser(req);
  return user ? user.role === UserRank.admin : false;
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
  const doesEntityExist = isValidObjectId
    ? !!(await Repo.get(collectionName)?.findOne(query(_id)))
    : false;

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
  requestPasswordReset,
  confirmPasswordResetRequest,
  forgotUsername,
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
