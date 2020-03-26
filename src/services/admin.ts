import { NextFunction, Request, Response } from 'express';
import { Collection, Db, ObjectId } from 'mongodb';

import { EUserRank, IEntity, IUserData } from '@kompakkt/shared';

import { Configuration } from './configuration';
import { Mongo, updateOne } from './mongo';
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
}

const Admin: IAdmin = {
  checkIsAdmin: async (req, res, next) => {
    const username = req.body.username;
    const sessionID = req.sessionID;
    const AccDB: Db = Mongo.getAccountsRepository();
    const users: Collection<IUserData> = AccDB.collection('users');
    const found = await users.findOne({ username, sessionID });
    if (!found || found.role !== EUserRank.admin) {
      return res.status(401).send('Could not verify your admin status');
    }
    return next();
  },
  getAllUsers: async (_, res) => {
    const AccDB: Db = Mongo.getAccountsRepository();
    const users: Collection<IUserData> = AccDB.collection('users');
    const filterProperties = ['sessionID', 'rank', 'prename', 'surname'];
    const allAccounts = await users.find({}).toArray();
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

    const AccDB: Db = Mongo.getAccountsRepository();
    const users: Collection<IUserData> = AccDB.collection('users');
    const filterProperties = ['sessionID', 'rank', 'prename', 'surname'];
    const user = await users.findOne({ _id });

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

    const AccDB: Db = Mongo.getAccountsRepository();
    const users: Collection<IUserData> = AccDB.collection('users');
    const user = await users.findOne({ _id });

    if (!user) return res.status(500).send('Updating user role failed');

    const updateResult = await updateOne(users, { _id }, { $set: { role } });
    if (updateResult.result.ok !== 1)
      return res.status(500).send('Updating user role failed');

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
    const found = await EntityCollection.findOne({ _id });
    if (!found)
      return res.status(404).send('No entity with this identifier found');

    const isEntityOnline: boolean = found.online;
    const updateResult = await updateOne(
      ObjDB.collection('entity'),
      { _id },
      { $set: { online: !isEntityOnline } },
    );
    if (updateResult.result.ok !== 1) {
      return res.status(500).send('Failed updating published state');
    }
    return res.status(200).send(await Mongo.resolve<IEntity>(_id, 'entity'));
  },
};

export { Admin };
