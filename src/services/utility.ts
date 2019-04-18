import { Collection, Db, ObjectId } from 'mongodb';

import { Mongo } from './mongo';

const Utility = {
  findAllModelOwners: async (request, response) => {
    const modelId = request.params.identifier;
    if (!ObjectId.isValid(modelId)) {
      response.send({ status: 'error', message: 'Invalid model _id '});
      return;
    }

    const AccDB: Db = await Mongo.getAccountsRepository();
    const ldap: Collection = AccDB.collection('ldap');
    const accounts = (await ldap.find({})
      .toArray())
      .filter(userData => {
        const Models = JSON.stringify(userData.data.model);
        return Models.indexOf(modelId) !== -1;
      })
      .map(userData => ({
          fullname: userData.fullname,
          username: userData.username,
          _id: userData._id,
        }));
    response.send({ status: 'ok', accounts });
  },

};

export { Utility };
