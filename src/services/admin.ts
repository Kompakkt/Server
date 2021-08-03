import { NextFunction, Request, Response } from 'express';
import { Collection, Db, ObjectId } from 'mongodb';

import { EUserRank, IEntity, IUserData } from '../common/interfaces';

import { updateUserPassword, IPasswordEntry } from './express';
import { generateSecurePassword } from './generate-password';
import { Configuration } from './configuration';
import { Mongo, updateOne, getCurrentUserBySession, users } from './mongo';
import { Mailer } from './mailer';
import { Logger } from './logger';

const checkAndReturnObjectId = (id: ObjectId | string) =>
  ObjectId.isValid(id) ? new ObjectId(id) : undefined;

interface IAdmin {
  checkIsAdmin(req: Request, res: Response, next: NextFunction): Promise<any>;
  getAllUsers(_: Request, res: Response): Promise<any>;
  getUser(req: Request, res: Response): any | void;
  promoteUserToRole(req: Request, res: Response): Promise<any>;
  toggleEntityPublishedState(req: Request, res: Response): Promise<any>;
  resetUserPassword(req: Request, res: Response): Promise<any>;
}

const Admin: IAdmin = {
  checkIsAdmin: async (req, res, next) => {
    const user = await getCurrentUserBySession(req);
    if (user?.role !== EUserRank.admin) {
      return res.status(401).send('Could not verify your admin status');
    }
    return next();
  },
  getAllUsers: async (_, res) => {
    const filterProperties = ['sessionID', 'rank', 'prename', 'surname'];
    const allAccounts = await users().find({}).toArray();
    const filteredAccounts = await Promise.all(
      allAccounts.map(account => {
        filterProperties.forEach(prop => ((account as any)[prop] = undefined));
        return account;
      }),
    );
    res.status(200).send(filteredAccounts);
  },
  getUser: async (req, res) => {
    const _id = checkAndReturnObjectId(req.params.identifier);
    if (!_id) return res.status(400).send('Invalid identifier');

    const user = await users().findOne<IUserData>(Mongo.query(_id));
    const filterProperties = ['sessionID', 'rank', 'prename', 'surname'];

    if (!user) return res.status(404).send('User not found');

    filterProperties.forEach(prop => ((user as any)[prop] = undefined));

    for (const coll in user.data) {
      for (let i = 0; i < user.data[coll].length; i++) {
        const obj = user.data[coll][i];
        user.data[coll][i] = await Mongo.resolve(obj, coll, 0);
      }
      // Filter null entities
      user.data[coll] = user.data[coll].filter(obj => obj);
    }
    return res.status(200).send(user);
  },
  promoteUserToRole: async (req, res) => {
    const _id = checkAndReturnObjectId(req.body.identifier);
    if (!_id) return res.status(400).send('Invalid identifier');
    const role = req.body.role;
    const validRoles = [
      EUserRank.user,
      EUserRank.uploadrequested,
      EUserRank.uploader,
      EUserRank.admin,
    ];
    if (!validRoles.includes(role)) {
      return res.status(400).send('Invalid role specified');
    }

    const user = await users().findOne(Mongo.query(_id));

    if (!user) return res.status(500).send('Updating user role failed');

    const updateResult = await updateOne(users(), Mongo.query(_id), { $set: { role } });
    if (!updateResult) return res.status(500).send('Updating user role failed');

    if (Configuration.Mailer && Configuration.Mailer.Target) {
      Mailer.sendMail({
        from: Configuration.Mailer.Target['contact'],
        to: user.mail,
        subject: 'Your Kompakkt role has been updated',
        text: `Hey ${user.fullname},\n\nYour role on Kompakkt has been changed from ${user.role} to ${role}\n\nVisit https://kompakkt.uni-koeln.de/profile to see what has changed`,
      })
        .then(result => Logger.log('Mail sent', result))
        .catch(error => Logger.warn('Failed to send mail', error));
    }
    return res.status(200).end();
  },
  toggleEntityPublishedState: async (req, res) => {
    const _id = checkAndReturnObjectId(req.body.identifier);
    if (!_id) return res.status(400).send('Incorrect req parameters');

    const ObjDB: Db = Mongo.getEntitiesRepository();
    const EntityCollection: Collection<IEntity> = ObjDB.collection('entity');
    const found = await EntityCollection.findOne(Mongo.query(_id));
    if (!found) return res.status(404).send('No entity with this identifier found');

    const isEntityOnline: boolean = found.online;
    const updateResult = await updateOne(ObjDB.collection('entity'), Mongo.query(_id), {
      $set: { online: !isEntityOnline },
    });
    if (!updateResult) return res.status(500).send('Failed updating published state');
    return res.status(200).send(await Mongo.resolve<IEntity>(_id, 'entity'));
  },
  resetUserPassword: async (req, res) => {
    const username = req.params.username;
    if (!username) return res.status(400).send('Invalid username');

    const passwords = Mongo.getAccountsRepository().collection<IPasswordEntry>('passwords');
    const user = await users().findOne({ username });
    const pwEntry = await passwords.findOne({ username });
    if (!user) return res.status(400).send('User not found');
    if (!pwEntry) return res.status(400).send('User has no existing password entry');

    const newPassword = generateSecurePassword();

    const success = await updateUserPassword(username, newPassword);

    if (success) {
      Logger.info(`Updated password for ${username}`);
      Mailer.sendMail({
        from: Configuration.Mailer.Target?.contact ?? 'noreply@kompakkt.de',
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
  },
};

export { Admin };
