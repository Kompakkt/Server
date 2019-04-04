import { Collection, Db } from 'mongodb';

import { Logger } from './logger';
import { Mongo } from './mongo';

const Cleaning = {
  deleteNullRefs: async (_, response) => {
    const AccDB: Db = Mongo.getAccountsRepository();
    const ldap: Collection = AccDB.collection('ldap');
    const allUsers = await ldap.find({})
      .toArray();

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

    const deleteUserNullRefs = async (user: any, nullrefs: any[]): Promise<boolean> => {
      for (const ref of nullrefs) {
        const index = user.data[ref.field].indexOf(ref._id);
        user.data[ref.field].splice(index, 1);
      }
      const updateResult = await ldap.updateOne({ _id: user._id }, { $set: { data: user.data } });
      if (updateResult.result.ok !== 1) {
        Logger.err(`Failed deleting missing references of user ${user._id}`);
        return false;
      }
      Logger.info(`Deleted ${nullrefs.length} missing references from user ${user._id}`);
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
