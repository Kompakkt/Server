import { Collection, Db, ObjectId } from 'mongodb';

import { ILDAPData, IModel } from '../interfaces';

import { Mongo } from './mongo';

const checkAndReturnObjectId = (id: ObjectId | string) =>
  ObjectId.isValid(id) ? new ObjectId(id) : undefined;

const Admin = {
  checkIsAdmin: async (request, response, next) => {
    const username = request.body.username;
    const sessionID = request.sessionID;
    const AccDB: Db = Mongo.getAccountsRepository();
    const ldap: Collection<ILDAPData> = AccDB.collection('local');
    const found = await ldap.findOne({ username, sessionID });
    if (!found || found.role !== 'A') {
      return response.send({ status: 'error', message: 'Could not verify your admin status' });
    }
    next();
  },
  getAllLDAPUsers: async (_, response) => {
    const AccDB: Db = Mongo.getAccountsRepository();
    const ldap: Collection<ILDAPData> = AccDB.collection('local');
    const filterProperties = ['sessionID', 'rank', 'prename', 'surname'];
    const allAccounts = await ldap.find({})
      .toArray();
    const filteredAccounts = await Promise.all(allAccounts
      .map(account => {
        filterProperties.forEach(prop => account[prop] = undefined);
        return account;
      })
      .map(async account => {
        for (const coll in account.data) {
          if (!account.data.hasOwnProperty(coll)) continue;
          for (let i = 0; i < account.data[coll].length; i++) {
            const obj = account.data[coll][i];
            account.data[coll][i] = await Mongo.resolve(obj, coll);
          }
          // Filter null objects
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
        const ldap: Collection<ILDAPData> = AccDB.collection('local');
        const updateResult = await ldap.updateOne({ _id }, { $set: { role } });
        if (updateResult.result.ok !== 1) {
          return response.send({ status: 'error', message: 'Updating user role failed' });
        }
        response.send({ status: 'ok', message: 'User role successfully updated' });
        break;
      default:
        response.send({ status: 'error', message: 'Invalid role specified' });
    }
  },
  toggleObjectPublishedState: async (request, response) => {
    const _id = checkAndReturnObjectId(request.body.identifier);
    if (!_id) {
      return response.send({ status: 'error', message: 'Incorrect request parameters' });
    }
    const ObjDB: Db = Mongo.getObjectsRepository();
    const ModelCollection: Collection<IModel> = ObjDB.collection('model');
    const found = await ModelCollection.findOne({ _id });
    if (!found) {
      return response.send({ status: 'error', message: 'No object with this identifier found' });
    }
    const isModelOnline: boolean = found.online;
    const updateResult = await ObjDB.collection('model')
      .updateOne({ _id }, { $set: { online: !isModelOnline } });
    if (updateResult.result.ok !== 1) {
      return response.send({ status: 'error', message: 'Failed updating published state' });
    }
    response.send({ status: 'ok', ...await Mongo.resolve(_id, 'model') });
  },
};

export { Admin };
