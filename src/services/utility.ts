import { Collection, Db, ObjectId } from 'mongodb';

import { Mongo } from './mongo';

const Utility = {
  findAllModelOwnersRequest: async (request, response) => {
    const modelId = request.params.identifier;
    if (!ObjectId.isValid(modelId)) {
      response.send({ status: 'error', message: 'Invalid model _id ' });
      return;
    }
    const accounts = await Utility.findAllModelOwners(modelId);
    response.send({ status: 'ok', accounts });
  },
  findAllModelOwners: async (modelId: string) => {
    const AccDB: Db = await Mongo.getAccountsRepository();
    const ldap: Collection = AccDB.collection('local');
    const accounts = (await ldap.find({})
      .toArray())
      .filter(userData => {
        const Models = JSON.stringify(userData.data.model);
        return (Models) ? Models.indexOf(modelId) !== -1 : false;
      })
      .map(userData => ({
        fullname: userData.fullname,
        username: userData.username,
        _id: userData._id,
      }));
    return accounts;
  },
  countModelUses: async (request, response) => {
    const modelId = request.params.identifier;
    if (!ObjectId.isValid(modelId)) {
      response.send({ status: 'error', message: 'Invalid model _id ' });
      return;
    }

    const ObjDB: Db = await Mongo.getObjectsRepository();
    const compilations = (await ObjDB.collection('compilation')
      .find({})
      .toArray())
      .filter(comp => {
        const Models = JSON.stringify(comp.models);
        return Models.indexOf(modelId) !== -1;
      });
    const occurences = compilations.length;

    response.send({ status: 'ok', occurences, compilations });
  },
  addAnnotationsToAnnotationList: async (request, response) => {
    const annotations = request.body.annotations;
    if (!annotations || !Array.isArray(annotations)) {
      response.send({ status: 'error', message: 'No annotation array sent' });
      return;
    }

    const compId = request.params.identifier;
    if (!compId || !ObjectId.isValid(compId)
      || await Mongo.resolve(compId, 'compilation') === undefined) {
      response.send({ status: 'error', message: 'Invalid compilation given' });
      return;
    }

    const ObjDB: Db = await Mongo.getObjectsRepository();
    const CompColl = ObjDB.collection('compilation');
    const compilation = await CompColl.findOne({ _id: new ObjectId(compId) });
    if (!compilation) {
      response.send({ status: 'error', message: 'Compilation not found' });
      return;
    }

    const resolvedAnnotations = await Promise.all(annotations
      .filter(ann => ObjectId.isValid(ann))
      .map(ann => Mongo.resolve(ann, 'annotation')));
    const validAnnotations = resolvedAnnotations
      .filter(ann => ann !== undefined && ann)
      .map(ann => {
        ann['_id'] = new ObjectId();
        ann['target']['source']['relatedCompilation'] = request.params.identifier;
        ann['lastModificationDate'] = new Date().toISOString();
        return ann;
      });
    const AnnColl = ObjDB.collection('annotation');
    const insertResult = await AnnColl.insertMany(validAnnotations);
    if (insertResult.result.ok !== 1) {
      response.send({ status: 'error', message: 'Failed inserting Annotations' });
      return;
    }

    compilation['annotationList'] = (compilation['annotationList'])
      ? compilation['annotationList'] : [];
    compilation['annotationList'] = Array.from(new Set(
      compilation['annotationList'].concat(validAnnotations)
        .map(ann => new ObjectId(ann['_id'])),
    ));

    const updateResult = await CompColl
      .updateOne(
        { _id: new ObjectId(compId) },
        { $set: { annotationList: compilation['annotationList'] } });
    if (updateResult.result.ok !== 1) {
      response.send({ status: 'error', message: 'Failed updating annotationList' });
      return;
    }

    // Add Annotations to LDAP user
    validAnnotations.forEach(ann => Mongo.insertCurrentUserData(request, ann['_id'], 'annotation'));
    response.send({ status: 'ok', ...await Mongo.resolve(compId, 'compilation') });
  },
  applyActionToModelOwner: async (request, response) => {
    const command = request.body.command;
    if (!['add', 'remove'].includes(command)) {
      return response.send({ status: 'error', message: 'Invalid command. Use "add" or "remove"' });
    }
    const ownerUsername = request.body.ownerUsername;
    const ownerId = request.body.ownerId;
    if (!ownerId && !ownerUsername) {
      return response.send({ status: 'error', message: 'No owner _id or username given' });
    }
    if (ownerId && !ownerUsername && !ObjectId.isValid(ownerId)) {
      return response.send({ status: 'error', message: 'Incorrect owner _id given' });
    }
    const modelId = request.body.modelId;
    if (!modelId || !ObjectId.isValid(modelId)
      || await Mongo.resolve(modelId, 'model') === undefined) {
      return response.send({ status: 'error', message: 'Invalid model identifier' });
    }
    const AccDB: Db = Mongo.getAccountsRepository();
    const ldap = await AccDB.collection('local');
    const findUserQuery = (ownerId) ? { _id: new ObjectId(ownerId) } : { username: ownerUsername };
    const account = await ldap.findOne(findUserQuery);
    if (!account) {
      return response.send({ status: 'error', message: 'Incorrect owner _id or username given' });
    }

    account.data.model = (account.data.model) ? account.data.model : [];

    switch (command) {
      case 'add':
        if (!account.data.model.find(obj => obj.toString() === modelId.toString())) {
          account.data.model.push(new ObjectId(modelId));
        }
        break;
      case 'remove':
        const modelUses = (await Utility.findAllModelOwners(modelId)).length;
        if (modelUses === 1) {
          return response.send({ status: 'error', message: 'Cannot remove last owner' });
        }
        account.data.model = account.data.model
          .filter(model => model.toString() !== modelId.toString());
        break;
      default:
    }

    const updateResult = await ldap.updateOne(
      findUserQuery,
      { $set: { data: account.data } });

    if (updateResult.result.ok !== 1) {
      return response.send({ status: 'error', message: 'Failed updating model array' });
    }

    response.send({ status: 'ok' });
  },
};

export { Utility };
