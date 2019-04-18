import { Collection, Db, ObjectId } from 'mongodb';

import { Mongo } from './mongo';

const Utility = {
  findAllModelOwners: async (request, response) => {
    const modelId = request.params.identifier;
    if (!ObjectId.isValid(modelId)) {
      response.send({ status: 'error', message: 'Invalid model _id ' });
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
    const validAnnotations = annotations
      .filter(ann => ObjectId.isValid(ann))
      .filter(async ann => await Mongo.resolve(ann, 'annotation') !== undefined);

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

    compilation['annotationList'] = (compilation['annotationList'])
      ? compilation['annotationList'] : [];
    compilation['annotationList'] = Array.from(new Set(
      compilation['annotationList'].concat(validAnnotations).map(ann => new ObjectId(ann))
    ));

    const updateResult = await CompColl
      .updateOne(
        { _id: new ObjectId(compId) },
        { $set: { annotationList: compilation['annotationList'] } });
    if (updateResult.result.ok !== 1) {
      response.send({ status: 'error', message: 'Failed updating annotationList' });
      return;
    }
    response.send({ status: 'ok', ...await Mongo.resolve(compId, 'compilation') });
  },
};

export { Utility };
