import { Request, Response } from 'express';
import { Collection, Db } from 'mongodb';

import { Logger } from './logger';
import { Mongo } from './mongo';

interface ICleaning {
  deleteUnusedPersonsAndInstitutions(
    _: Request,
    response: Response,
  ): Promise<any>;
  deleteNullRefs(_: Request, response: Response): Promise<any>;
}

const Cleaning: ICleaning = {
  deleteUnusedPersonsAndInstitutions: async (_, response) => {
    const ObjDB: Db = Mongo.getEntitiesRepository();
    const personCollection = ObjDB.collection('person');
    const instCollection = ObjDB.collection('institution');
    const digobjCollection = ObjDB.collection('digitalentity');
    const phyobjCollection = ObjDB.collection('physicalentity');
    const allPersons = await personCollection.find({}).toArray();
    const allInstitutions = await instCollection.find({}).toArray();
    const allDigObjs = await digobjCollection.find({}).toArray();
    const allPhyObjs = await phyobjCollection.find({}).toArray();

    const total: any[] = [];

    // TODO: Delete Tags

    const fullJSON = `${JSON.stringify(allDigObjs)}${JSON.stringify(
      allPhyObjs,
    )}`;
    for (const person of allPersons) {
      const _id = person._id;
      const index = fullJSON.indexOf(_id);
      if (index !== -1) continue;
      const deleteResult = await personCollection.deleteOne({
        _id: person._id,
      });
      if (deleteResult.result.ok === 1) {
        Logger.info(`Deleted unused person ${person}`);
        total.push({ person, result: deleteResult.result });
      }
    }
    for (const institution of allInstitutions) {
      const _id = institution._id;
      const index = fullJSON.indexOf(_id);
      if (index !== -1) continue;
      const deleteResult = await instCollection.deleteOne({
        _id: institution._id,
      });
      if (deleteResult.result.ok === 1) {
        Logger.info(`Deleted unused institution ${institution}`);
        total.push({ institution, result: deleteResult.result });
      }
    }

    Logger.log(`Deleted ${total.length} unused persons and/or institutions`);
    response.send({ status: 'ok', total, amount: total.length });
  },
  deleteNullRefs: async (_, response) => {
    const AccDB: Db = Mongo.getAccountsRepository();
    const ldap: Collection = AccDB.collection('users');
    const allUsers = await ldap.find({}).toArray();

    const total: any[] = [];

    const checkReferences = async (array: any[], field: string) => {
      const deletedReferences: any[] = [];
      for (const _id of array) {
        const result = await Mongo.resolve(_id, field);
        if (result !== null) continue;
        deletedReferences.push({ field, _id });
      }
      return deletedReferences;
    };

    const deleteUserNullRefs = async (
      user: any,
      nullrefs: any[],
    ): Promise<boolean> => {
      for (const ref of nullrefs) {
        const index = user.data[ref.field].indexOf(ref._id);
        user.data[ref.field].splice(index, 1);
      }
      const updateResult = await ldap.updateOne(
        { _id: user._id },
        { $set: { data: user.data } },
      );
      if (updateResult.result.ok !== 1) {
        Logger.err(`Failed deleting missing references of user ${user._id}`);
        return false;
      }
      Logger.info(
        `Deleted ${nullrefs.length} missing references from user ${user._id}`,
      );
      return true;
    };

    const iterateOverUserData = async (user: any) => {
      for (const property in user.data) {
        if (!user.data.hasOwnProperty(property)) continue;
        if (user.data[property] instanceof Array) {
          if (user.data[property].length <= 0) continue;
          const nullRefs = await checkReferences(user.data[property], property);
          if (nullRefs.length === 0) continue;
          const success = await deleteUserNullRefs(user, nullRefs);
          if (success) total.push({ user, nullRefs });
        }
      }
    };

    for (const user of allUsers) {
      await iterateOverUserData(user);
    }
    response.send({ status: 'ok', total });
  },
};

export { Cleaning };
