import { NextFunction, Request, Response } from 'express';
import { Collection, Db, ObjectId } from 'mongodb';

import { IEntity, IUserData, EUserRank } from '../interfaces';

import { Mongo } from './mongo';

const checkAndReturnObjectId = (id: ObjectId | string) =>
  ObjectId.isValid(id) ? new ObjectId(id) : undefined;

interface IAdmin {
  checkIsAdmin(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<any>;
  getAllUsers(_: Request, response: Response): Promise<any>;
  getUser(request: Request, response: Response): Promise<any>;
  promoteUserToRole(request: Request, response: Response): Promise<any>;
  toggleEntityPublishedState(
    request: Request,
    response: Response,
  ): Promise<any>;
}

const Admin: IAdmin = {
  checkIsAdmin: async (request, response, next) => {
    const username = request.body.username;
    const sessionID = request.sessionID;
    const AccDB: Db = Mongo.getAccountsRepository();
    const users: Collection<IUserData> = AccDB.collection('users');
    const found = await users.findOne({ username, sessionID });
    if (!found || found.role !== EUserRank.admin) {
      return response.send({
        status: 'error',
        message: 'Could not verify your admin status',
      });
    }
    return next();
  },
  getAllUsers: async (_, response) => {
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
    response.send({ status: 'ok', users: filteredAccounts });
  },
  getUser: async (request, response) => {
    const _id = checkAndReturnObjectId(request.params.identifier);
    if (!_id) {
      response.send({ status: 'error', message: 'Invalid identifier' });
      return;
    }

    const AccDB: Db = Mongo.getAccountsRepository();
    const users: Collection<IUserData> = AccDB.collection('users');
    const filterProperties = ['sessionID', 'rank', 'prename', 'surname'];
    const user = await users.findOne({ _id });

    if (!user) {
      response.send({ status: 'error', message: 'User not found' });
      return;
    }

    filterProperties.forEach(prop => ((user as any)[prop] = undefined));

    for (const coll in user.data) {
      if (!user.data.hasOwnProperty(coll)) continue;
      for (let i = 0; i < user.data[coll].length; i++) {
        const obj = user.data[coll][i];
        user.data[coll][i] = await Mongo.resolve(obj, coll, 0);
      }
      // Filter null entities
      user.data[coll] = user.data[coll].filter(obj => obj);
    }
    response.send({ status: 'ok', ...user });
  },
  promoteUserToRole: async (request, response) => {
    const _id = checkAndReturnObjectId(request.body.identifier);
    if (!_id) {
      return response.send({ status: 'error', message: 'Invalid identifier' });
    }
    const role = request.body.role;
    switch (role) {
      case EUserRank.user:
      case EUserRank.uploader:
      case EUserRank.admin:
        const AccDB: Db = Mongo.getAccountsRepository();
        const users: Collection<IUserData> = AccDB.collection('users');
        const updateResult = await users.updateOne({ _id }, { $set: { role } });
        if (updateResult.result.ok !== 1) {
          return response.send({
            status: 'error',
            message: 'Updating user role failed',
          });
        }
        return response.send({
          status: 'ok',
          message: 'User role successfully updated',
        });
        break;
      default:
        return response.send({
          status: 'error',
          message: 'Invalid role specified',
        });
    }
  },
  toggleEntityPublishedState: async (request, response) => {
    const _id = checkAndReturnObjectId(request.body.identifier);
    if (!_id) {
      return response.send({
        status: 'error',
        message: 'Incorrect request parameters',
      });
    }
    const ObjDB: Db = Mongo.getEntitiesRepository();
    const EntityCollection: Collection<IEntity> = ObjDB.collection('entity');
    const found = await EntityCollection.findOne({ _id });
    if (!found) {
      return response.send({
        status: 'error',
        message: 'No entity with this identifier found',
      });
    }
    const isEntityOnline: boolean = found.online;
    const updateResult = await ObjDB.collection('entity').updateOne(
      { _id },
      { $set: { online: !isEntityOnline } },
    );
    if (updateResult.result.ok !== 1) {
      return response.send({
        status: 'error',
        message: 'Failed updating published state',
      });
    }
    return response.send({
      status: 'ok',
      ...(await Mongo.resolve(_id, 'entity')),
    });
  },
};

export { Admin };
