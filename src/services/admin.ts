import { NextFunction, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { UserRank, IEntity } from '../common';
import { updateUserPassword } from './express';
import { generateSecurePassword } from './generate-password';
import { Configuration } from './configuration';
import { Mailer } from './mailer';
import { Logger } from './logger';
import { Entities, Users, Accounts, Repo, query, isValidCollection, isValidId } from './db';

interface IIdentifierRequest {
  identifier?: string | ObjectId;
}

interface IRoleRequest {
  role?: UserRank;
}

interface IUsernameRequest {
  username?: string;
}

const checkIsAdmin = async (
  req: Request<any, any, Partial<IUsernameRequest>>,
  res: Response,
  next: NextFunction,
) => {
  const { username } = req.body;
  if (!username || typeof username !== 'string')
    return res.status(400).send('Incorrect username or password');

  const user = await Users.getByUsername(username);
  if (user?.role !== UserRank.admin)
    return res.status(401).send('Could not verify your admin status');

  return next();
};

const getAllUsers = async (_: Request, res: Response) => {
  const filterProperties = ['sessionID', 'rank', 'prename', 'surname'];
  const allAccounts = await Accounts.users.findAll();
  const filteredAccounts = await Promise.all(
    allAccounts.map(account => {
      // TODO: Typing
      for (const prop of filterProperties) {
        (account as any)[prop] = undefined;
        delete (account as any)[prop];
      }
      return account;
    }),
  );
  res.status(200).send(filteredAccounts);
};

const getUser = async (req: Request<IIdentifierRequest>, res: Response) => {
  const _id = req.params.identifier;
  if (!isValidId(_id)) return res.status(400).send('Invalid identifier');

  const user = await Accounts.users.findOne(query(_id));
  const filterProperties = ['sessionID', 'rank', 'prename', 'surname'];

  if (!user) return res.status(404).send('User not found');

  filterProperties.forEach(prop => ((user as any)[prop] = undefined));

  for (const coll in user.data) {
    if (!isValidCollection(coll)) continue;
    if (user.data[coll] === undefined) continue;
    for (let i = 0; i < user.data[coll]!.length; i++) {
      const obj = user.data[coll]![i];
      user.data[coll]![i] = await Entities.resolve(obj, coll, 0);
    }
    // Filter null entities
    user.data[coll] = user.data[coll]!.filter(obj => obj);
  }
  return res.status(200).send(user);
};

const promoteUserToRole = async (
  req: Request<any, any, IIdentifierRequest & IRoleRequest>,
  res: Response,
) => {
  const { identifier, role } = req.body;

  const _id = identifier;
  if (!isValidId(_id)) return res.status(400).send('Invalid identifier');

  const validRoles = Object.values(UserRank);
  if (!role || !validRoles.includes(role)) return res.status(400).send('Invalid role specified');

  const user = await Accounts.users.findOne(query(_id));
  if (!user) return res.status(500).send('Updating user role failed');

  const updateResult = await Accounts.users.updateOne(query(_id), { $set: { role } });
  if (!updateResult) return res.status(500).send('Updating user role failed');

  if (Configuration.Mailer && Configuration.Mailer.Target) {
    Mailer.sendMail({
      from: Configuration.Mailer.Target['contact'],
      to: user.mail,
      subject: 'Your Kompakkt role has been updated',
      text: `Hey ${user.fullname},\n\nYour role on Kompakkt has been changed from ${user.role} to ${role}\n\nVisit https://kompakkt.de/profile to see what has changed`,
    })
      .then(result => Logger.log('Mail sent', result))
      .catch(error => Logger.warn('Failed to send mail', error));
  }
  return res.status(200).end();
};

const toggleEntityPublishedState = async (
  req: Request<any, any, IIdentifierRequest>,
  res: Response,
) => {
  const _id = req.body.identifier;
  if (!isValidId(_id)) return res.status(400).send('Incorrect req parameters');

  const found = await Repo.entity.findOne(query(_id));
  if (!found) return res.status(404).send('No entity with this identifier found');

  const isEntityOnline: boolean = found.online;
  const updateResult = await Repo.entity.updateOne(query(_id), {
    $set: { online: !isEntityOnline },
  });
  if (!updateResult) return res.status(500).send('Failed updating published state');
  return res.status(200).send(await Entities.resolve<IEntity>(_id, 'entity'));
};

const resetUserPassword = async (req: Request<IUsernameRequest>, res: Response) => {
  const username = req.params.username;
  if (!username) return res.status(400).send('Invalid username');

  const user = await Accounts.users.findOne({ username });
  const pwEntry = await Accounts.passwords.findOne({ username });
  if (!user) return res.status(400).send('User not found');
  if (!pwEntry) return res.status(400).send('User has no existing password entry');

  const newPassword = generateSecurePassword();

  const success = await updateUserPassword(username, newPassword);

  if (success) {
    Logger.info(`Updated password for ${username}`);
    Mailer.sendMail({
      from: Configuration.Mailer?.Target?.contact ?? 'noreply@kompakkt.de',
      to: user.mail,
      subject: '[Kompakkt] Your password has been reset',
      text: `
Dear ${user.fullname},

This is an automated message by Kompakkt.

Your password has been reset by an administrator.
Username:
${user.username}
Password:
${newPassword}

This change can not be reverted. If you did not request a password reset
and suspect suspicious activity, please reply to this mail.

Kind regards,
Kompakkt Team
`.trim(),
    });
    return res.status(200).end();
  } else {
    Logger.err(`Failed updating password for ${username}`);
    return res.status(400).send('Failed updating password');
  }
};

const Admin = {
  checkIsAdmin,
  getAllUsers,
  getUser,
  promoteUserToRole,
  toggleEntityPublishedState,
  resetUserPassword,
};

export { Admin };
