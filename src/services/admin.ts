import { Collection, Db, ObjectId } from 'mongodb';

import { Mongo } from './mongo';

const checkAndReturnObjectId = (id: ObjectId | string) =>
  ObjectId.isValid(id) ? new ObjectId(id) : undefined;

const Admin = {
  checkIsAdmin: async (request, response, next) => {
    const username = request.body.username;
    const AccDB: Db = Mongo.getAccountsRepository();
    const ldap: Collection = AccDB.collection('ldap');
    const found = await ldap.findOne({ username });
    if (!found || found.role !== 'A') {
      response.send({ status: 'error', message: 'Could not verify your admin status' });
      return;
    }
    next();
  },
  getAllLDAPUsers: async (_, response) => {
    const AccDB: Db = Mongo.getAccountsRepository();
    const ldap: Collection = AccDB.collection('ldap');
    const filterProperties = ['sessionID', 'rank', 'prename', 'surname'];
    const allAccounts = await ldap.find({})
      .toArray();
    const filteredAccounts = allAccounts
      .map(account => {
        for (const prop of filterProperties) {
          delete account[prop];
        }
        return account;
      });
    response.send({ status: 'ok', users: filteredAccounts });
  },
  promoteUserToRole: async (request, response) => {
    const _id = checkAndReturnObjectId(request.body.identifier);
    if (!_id) {
      response.send({ status: 'error', message: 'Invalid identifier' });
      return;
    }
    const role = request.body.role;
    switch (role) {
      case 'S': case 'B': case 'U': case 'A':
        const AccDB: Db = Mongo.getAccountsRepository();
        const ldap: Collection = AccDB.collection('ldap');
        const updateResult = await ldap.updateOne({ _id }, { $set: { role } });
        if (updateResult.result.ok !== 1) {
          response.send({ status: 'error', message: 'Updating user role failed' });
          return;
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
      response.send({ status: 'error', message: 'Incorrect request parameters' });
      return;
    }
    const ObjDB: Db = Mongo.getObjectsRepository();
    const ModelCollection = ObjDB.collection('model');
    const found = await ModelCollection.findOne({ _id });
    if (!found) {
      response.send({ status: 'error', message: 'No object with this identifier found' });
      return;
    }
    const isModelOnline: boolean = found.online;
    const updateResult = await ObjDB.collection('model')
      .updateOne({ _id }, { $set: { online: !isModelOnline } });
    if (updateResult.result.ok !== 1) {
      response.send({ status: 'error', message: 'Failed updating published state' });
      return;
    }
    response.send({ status: 'ok', ...await Mongo.resolve(_id, 'model') });
  },
};

export { Admin };
