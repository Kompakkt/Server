import { Collection, Db, ObjectId } from 'mongodb';

import { Mongo } from './mongo';

const Admin = {
  checkIsAdmin: async (request, response, next) => {
    const username = request.body.username;
    const AccDB: Db = Mongo.getAccountsRepository();
    const ldap: Collection = AccDB.collection('ldap');
    const found = await ldap.findOne({ username });
    if (!found || found.role !== 'A') {
      response.send({ status: 'error', message: 'Could not verify your admin status'});
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
    const filteredAccounts =  allAccounts
      .map(account => {
        for (const prop of filterProperties) {
          delete account[prop];
        }
        return account;
      });
    response.send({ status: 'ok', users: filteredAccounts });
  },
  promoteUserToRole: async (request, response) => {
    const identifier = request.body.identifier;
    const _id = ObjectId.isValid(identifier) ? new ObjectId(identifier) : undefined;
    if (!_id) {
      response.send({ status: 'error', message: 'Invalid identifier'});
      return;
    }
    const role = request.body.role;
    const AccDB: Db = Mongo.getAccountsRepository();
    const ldap: Collection = AccDB.collection('ldap');
    const updateResult = await ldap.updateOne({ _id }, { $set: { role }});
    if (updateResult.result.ok !== 1) {
      response.send({ status: 'error', message: 'Updating user role failed' });
      return;
    }
    response.send({ status: 'success', message: 'User role successfully updated'});
  },
};

export { Admin };
