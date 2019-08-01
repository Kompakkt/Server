import { NextFunction, Request, Response } from 'express';
import { Collection, Db, ObjectId } from 'mongodb';

import { IEntity, ILDAPData } from '../interfaces';

import { Mongo } from './mongo';

const checkAndReturnObjectId = (id: ObjectId | string) =>
  ObjectId.isValid(id) ? new ObjectId(id) : undefined;

interface IAdmin {
  checkIsAdmin(request: Request, response: Response, next: NextFunction): Promise<any>;
  getAllLDAPUsers(_: Request, response: Response): Promise<any>;
  promoteUserToRole(request: Request, response: Response): Promise<any>;
  toggleEntityPublishedState(request: Request, response: Response): Promise<any>;
}

const Admin: IAdmin = {
  checkIsAdmin: async (request, response, next) => {
    const username = request.body.username;
    const sessionID = request.sessionID;
    const AccDB: Db = Mongo.getAccountsRepository();
    const ldap: Collection<ILDAPData> = AccDB.collection('users');
    const found = await ldap.findOne({ username, sessionID });
    if (!found || found.role !== 'A') {
      return response.send({ status: 'error', message: 'Could not verify your admin status' });
    }
    return next();
  },
  getAllLDAPUsers: async (_, response) => {
    const AccDB: Db = Mongo.getAccountsRepository();
    const ldap: Collection<ILDAPData> = AccDB.collection('users');
    const filterProperties = ['sessionID', 'rank', 'prename', 'surname'];
    const allAccounts = await ldap.find({})
      .toArray();
    const filteredAccounts = await Promise.all(allAccounts
      .map(account => {
        filterProperties.forEach(prop => (account as any)[prop] = undefined);
        return account;
      })
      .map(async account => {
        for (const coll in account.data) {
          if (!account.data.hasOwnProperty(coll)) continue;
          for (let i = 0; i < account.data[coll].length; i++) {
            const obj = account.data[coll][i];
            account.data[coll][i] = await Mongo.resolve(obj, coll);
          }
          // Filter null entities
          account.data[coll] = account.data[coll].filter(obj => obj);
        }
        return account;
      }));
    response.send({ status: 'ok', users: filteredAccounts });
  },
  promoteUserToRole: async (request, response) => {
    const _id = checkAndReturnObjectId(request.body.identifier);
    if (!_id) {
      return response.send({ status: 'error', message: 'Invalid identifier' });
    }
    const role = request.body.role;
    switch (role) {
      case 'S': case 'B': case 'U': case 'A':
        const AccDB: Db = Mongo.getAccountsRepository();
        const ldap: Collection<ILDAPData> = AccDB.collection('users');
        const updateResult = await ldap.updateOne({ _id }, { $set: { role } });
        if (updateResult.result.ok !== 1) {
          return response.send({ status: 'error', message: 'Updating user role failed' });
        }
        return response.send({ status: 'ok', message: 'User role successfully updated' });
        break;
      default:
        return response.send({ status: 'error', message: 'Invalid role specified' });
    }
  },
  toggleEntityPublishedState: async (request, response) => {
    const _id = checkAndReturnObjectId(request.body.identifier);
    if (!_id) {
      return response.send({ status: 'error', message: 'Incorrect request parameters' });
    }
    const ObjDB: Db = Mongo.getEntitiesRepository();
    const EntityCollection: Collection<IEntity> = ObjDB.collection('entity');
    const found = await EntityCollection.findOne({ _id });
    if (!found) {
      return response.send({ status: 'error', message: 'No entity with this identifier found' });
    }
    const isEntityOnline: boolean = found.online;
    const updateResult = await ObjDB.collection('entity')
      .updateOne({ _id }, { $set: { online: !isEntityOnline } });
    if (updateResult.result.ok !== 1) {
      return response.send({ status: 'error', message: 'Failed updating published state' });
    }
    return response.send({ status: 'ok', ...await Mongo.resolve(_id, 'entity') });
  },
};

export { Admin };
