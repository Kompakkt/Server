/* tslint:disable:max-line-length */
import { Response } from 'express';
import { writeFileSync } from 'fs';
import { ensureDirSync } from 'fs-extra';
import * as imagemin from 'imagemin';
import * as pngquant from 'imagemin-pngquant';
import { Collection, Db, InsertOneWriteOpResult, MongoClient, ObjectId } from 'mongodb';

import { RootDirectory } from '../environment';
import { ILDAPData, IMetaDataDigitalObject, IModel } from '../interfaces';

import { Configuration } from './configuration';
import { Logger } from './logger';
import { resolveCompilation, resolveDigitalObject, resolveModel } from './resolving-strategies';
import { saveAnnotation, saveCompilation, saveDigitalObject, saveModel } from './saving-strategies';
import { isAnnotation, isCompilation, isDigitalObject, isModel } from './typeguards';
import { Utility } from './utility';
/* tslint:enable:max-line-length */

const MongoConf = Configuration.Mongo;
const UploadConf = Configuration.Uploads;

const ldap = (): Collection<ILDAPData> =>
  getAccountsRepository()
    .collection('users');
const getCurrentUserBySession = async (sessionID: string) =>
  ldap()
    .findOne({ sessionID });
const getUserByUsername = async (username: string) =>
  ldap()
    .findOne({ username });
const getAllItemsOfCollection = async (collection: string) =>
  getObjectsRepository()
    .collection(collection)
    .find({})
    .toArray();

const saveBase64toImage = async (
  base64input: string, subfolder: string, identifier: string | ObjectId) => {
  const saveId = identifier.toString();
  let finalImagePath = '';
  // TODO: Solve without try-catch block
  // TODO: Convert to progressive JPEG?
  try {
    if (base64input.indexOf('data:image') !== -1) {
      const replaced = base64input.replace(/^data:image\/(png|gif|jpeg);base64,/, '');
      const tempBuff = Buffer.from(replaced, 'base64');
      await imagemin.buffer(tempBuff, {
        plugins: [pngquant.default({
          speed: 1,
          strip: true,
          dithering: 1,
        })],
      })
        .then(res => {
          ensureDirSync(`${RootDirectory}/${UploadConf.UploadDirectory}/previews/${subfolder}/`);
          writeFileSync(
            `${RootDirectory}/${UploadConf.UploadDirectory}/previews/${subfolder}/${saveId}.png`,
            res);

          finalImagePath = `previews/${subfolder}/${saveId}.png`;
        })
        .catch(e => Logger.err(e));
    } else {
      finalImagePath = `previews/${base64input.split('previews/')[1]}`;
    }
  } catch (e) {
    Logger.err(e);
    return finalImagePath;
  }
  const https = Configuration.Express.enableHTTPS ? 'https' : 'http';
  const pubip = Configuration.Express.PublicIP;
  const port = Configuration.Express.Port;
  return `${https}://${pubip}:${port}/${finalImagePath}`;
};

const MongoURL = `mongodb://${MongoConf.Hostname}:${MongoConf.Port}/`;
const Client = new MongoClient(MongoURL, {
  useNewUrlParser: true,
  reconnectTries: Number.POSITIVE_INFINITY,
  reconnectInterval: 1000,
});
const getAccountsRepository = (): Db => Client.db(MongoConf.AccountsDB);
const getObjectsRepository = (): Db => Client.db(MongoConf.RepositoryDB);

const Mongo = {
  init: async () => {
    await Client.connect(async (error, _) => {
      if (!error) return;
      Logger.err(
        `Couldn't connect to MongoDB. Make sure it is running and check your configuration`);
      process.exit(1);
    });
  },
  isMongoDBConnected: async (_, response, next) => {
    const isConnected = await Client.isConnected();
    if (isConnected) {
      next();
    } else {
      Logger.warn('Incoming request while not connected to MongoDB');
      response.send({ message: 'Cannot connect to Database. Contact sysadmin' });
    }
  },
  getAccountsRepository, getObjectsRepository, saveBase64toImage,
  /**
   * Fix cases where an ObjectId is sent but it is not detected as one
   * used as Middleware
   */
  fixObjectId: async (request, _, next) => {
    if (request) {
      if (request.body && request.body['_id'] && ObjectId.isValid(request.body['_id'])) {
        request.body['_id'] = new ObjectId(request.body['_id']);
      }
    }
    next();
  },
  getUnusedObjectId: async (_, response) => {
    response.send(new ObjectId());
  },
  invalidateSession: async (request, response) => {
    const sessionID = request.sessionID;
    ldap()
      .updateMany({ sessionID }, { $set: { sessionID: '' } }, () => {
        Logger.log('Logged out');
        response.send({ status: 'ok', message: 'Logged out' });
      });
  },
  updateSessionId: async (request, response, next) => {
    const user = request.user;
    const username = request.body.username.toLowerCase();
    const sessionID = request.sessionID;
    const userData = await getUserByUsername(username) || {};

    const updateResult = await ldap()
      .updateOne({ username }, {
        $set: {
          username, sessionID, ...user,
          role: (userData['role'])
                ? ((userData['role'] === '')
                  ? user['role']
                  : userData['role'])
                : user['role'],
        },
      });

    if (updateResult.result.ok !== 1) {
      return response.send({ status: 'error', message: 'Failed updating user in database' });
    }
    next();
  },
  addToAccounts: async (request, response) => {
    const user = request.user;
    const username = request.body.username.toLowerCase();
    const sessionID = request.sessionID;
    const userData = await getUserByUsername(username);

    // Users returned by local strategy might have _id field
    // _id is immutable in MongoDB, so we can't update the field
    // tslint:disable-next-line:no-dynamic-delete
    delete user['_id'];

    if (!userData) {
      ldap()
        .insertOne(
          {
            ...user, _id: new ObjectId(),
            username, sessionID,
            data: {},
          },
          (ins_err, ins_res) => {
            if (ins_err) {
              response.send({ status: 'error' });
              Logger.err(ins_res);
            } else {
              Logger.info(ins_res.ops);
              const resultUser = ins_res.ops[0];
              response.send({ status: 'ok', ...resultUser });
            }
          });
    } else {
      ldap()
        .updateOne(
          { username },
          {
            $set: {
              ...user, sessionID,
              role: (userData['role'])
                ? ((userData['role'] === '')
                  ? user['role']
                  : userData['role'])
                : user['role'],
            },
          },
          (up_err, _) => {
            if (up_err) {
              response.send({ status: 'error' });
              Logger.err(up_err);
            } else {
              ldap()
                .findOne({ sessionID, username }, (f_err, f_res) => {
                  if (f_err || !f_res) {
                    response.send({ status: 'error', message: 'Updated user not found' });
                    Logger.err(f_err);
                  } else {
                    response.send({ status: 'ok', ...f_res });
                  }
                });
            }
          });
    }
  },
  insertCurrentUserData: async (request, identifier, collection) => {
    const sessionID = request.sessionID;
    const userData = await getCurrentUserBySession(sessionID);

    if (!ObjectId.isValid(identifier) || !userData) return false;

    userData.data[collection] = (userData.data[collection])
      ? userData.data[collection] : [];

    const doesExist = userData.data[collection]
      .filter(obj => obj)
      .find((obj: any) => obj.toString() === identifier.toString());

    if (doesExist) return true;

    userData.data[collection].push(new ObjectId(identifier));
    const updateResult = await ldap()
      .updateOne(
        { sessionID }, { $set: { data: userData.data } });

    if (updateResult.result.ok !== 1) return false;
    return true;
  },
  getCurrentUserData: async (request, response) => {
    const sessionID = request.sessionID;
    const userData = await getCurrentUserBySession(sessionID);
    if (!userData) {
      return response
        .send({ status: 'error', message: 'User not found by sessionID. Try relogging' });
    }
    if (userData.data) {
      for (const property in userData.data) {
        if (!userData.data.hasOwnProperty(property)) continue;
        userData.data[property] = await Promise.all(
          userData.data[property].map(async obj => Mongo.resolve(obj, property)));
        // Filter possible null's
        userData.data[property] = userData.data[property].filter(obj => obj);
      }
      // Add model owners to models
      if (userData.data.model && userData.data.model.length > 0) {
        for (const model of userData.data.model) {
          if (!model) continue;
          model['relatedModelOwners'] =
            await Utility.findAllModelOwners(model['_id']);
        }
      }
    }

    response.send({ status: 'ok', ...userData });
  },
  validateLoginSession: async (request, response, next) => {
    const sessionID = request.sessionID = (request.cookies['connect.sid']) ?
      request.cookies['connect.sid'].substr(2, 36) : request.sessionID;

    const userData = await getCurrentUserBySession(sessionID);
    if (!userData) {
      return response.send({ status: 'error', message: 'Invalid session' });
    }
    next();
  },
  submitService: async (request, response) => {
    const digobjCollection: Collection<IMetaDataDigitalObject> =
      getObjectsRepository()
        .collection('digitalobject');
    const modelCollection: Collection<IModel> =
      getObjectsRepository()
        .collection('model');

    const service: string = request.params.service;
    if (!service) response.send({ status: 'error', message: 'Incorrect request' });

    const mapTypes = (resType: string) => {
      let type = resType;
      type = type.toLowerCase();
      switch (type) {
        case 'sound': type = 'audio'; break;
        case 'picture': type = 'image'; break;
        case '3d': type = 'model'; break;
        default:
      }
      return type;
    };

    // After adding a digitalobject inside of a model,
    // attach data to the current user
    const insertFinalModelToCurrentUser = (modelResult: InsertOneWriteOpResult) => {
      Mongo.insertCurrentUserData(request, modelResult.ops[0]._id, 'model')
        .then(() => {
          response.send({ status: 'ok', result: modelResult.ops[0] });
          Logger.info(`Added Europeana object ${modelResult.ops[0]._id}`);
        })
        .catch(err => {
          Logger.err(err);
          response.send({ status: 'error', message: 'Failed adding finalized object to user' });
        });
    };

    // After adding a digitalobject, add digitalobject
    // to a model and push the model
    const pushModel = (digobjResult: InsertOneWriteOpResult) => {
      const resultObject = digobjResult.ops[0];
      const modelObject: IModel = {
        _id: new ObjectId(),
        annotationList: [],
        relatedDigitalObject: {
          _id: resultObject._id,
        },
        name: resultObject.digobj_title,
        ranking: 0,
        files: [],
        finished: true,
        online: true,
        mediaType: mapTypes(request.body.type),
        dataSource: {
          isExternal: true,
          service,
        },
        processed: {
          low: request.body._fileUrl,
          medium: request.body._fileUrl,
          high: request.body._fileUrl,
          raw: request.body._fileUrl,
        },
        settings: {
          preview: (request.body._previewUrl)
            ? request.body._previewUrl
            : '/previews/noimage.png',
        },
      };
      modelCollection.insertOne(modelObject)
        .then(insertFinalModelToCurrentUser)
        .catch(err => {
          Logger.err(err);
          response.send({ status: 'error', message: 'Failed finalizing digitalobject' });
        });
    };

    switch (service) {
      case 'europeana':
        // TODO: Put into Europeana service to make every service self sustained?
        const EuropeanaObject: IMetaDataDigitalObject = {
          _id: new ObjectId(),
          digobj_type: mapTypes(request.body.type),
          digobj_title: request.body.title,
          digobj_description: request.body.description,
          digobj_licence: request.body.license,
          digobj_externalLink: [{
            externalLink_description: 'Europeana URL',
            externalLink_value: request.body.page,
          }],
          digobj_externalIdentifier: [],
          digobj_discipline: [],
          digobj_creation: [],
          digobj_dimensions: [],
          digobj_files: [],
          digobj_objecttype: '',
          digobj_person: [],
          digobj_rightsowner: [],
          digobj_statement: '',
          digobj_tags: [],
          digobj_metadata_files: [],
          digobj_person_existing: [],
          digobj_rightsowner_institution: [],
          digobj_rightsowner_person: [],
          digobj_rightsownerSelector: 1,
          digobj_person_existing_role: [],
          contact_person: [],
          contact_person_existing: [],
          phyObjs: [],
        };

        digobjCollection.insertOne(EuropeanaObject)
          .then(pushModel)
          .catch(err => {
            Logger.err(err);
            response.send({ status: 'error', message: `Couldn't add as digitalobject` });
          });

        break;
      default:
        response.send({ status: 'error', message: `Service ${service} not configured` });
    }
  },
  /**
   * When the user submits the metadataform this function
   * adds the missing data to defined collections
   */
  submit: async (request, response) => {
    Logger.info('Handling submit request');

    request.params.collection = 'digitalobject';
    Mongo.addObjectToCollection(request, response);

    /*const collection: Collection<IMetaDataDigitalObject> =
      getObjectsRepository()
        .collection('digitalobject');
    const resultObject: IMetaDataDigitalObject = { ...request.body };

    collection.updateOne({ _id: finalObject['_id'] }, { $set: finalObject }, { upsert: true })
      .then(() => Mongo.resolve(finalObject['_id'], 'digitalobject'))
      .then(data => {
        Logger.info(`Finished Object ${finalObject['_id']}`);
        response.send({ status: 'ok', data });
      })
      .catch(e => {
        Logger.err(e);
        response.send({ status: 'error', message: 'Failed to add' });
      });*/
  },
  addObjectToCollection: async (request, response: Response) => {
    const RequestCollection = request.params.collection.toLowerCase();

    Logger.info(`Adding to the following collection: ${RequestCollection}`);

    const collection: Collection = getObjectsRepository()
      .collection(RequestCollection);

    let resultObject = request.body;
    const userData = await getCurrentUserBySession(request.sessionID);
    if (!userData) {
      return response
        .send({ status: 'error', message: 'Cannot fetch current user from database' });
    }

    const isValidObjectId = ObjectId.isValid(resultObject['_id']);
    // tslint:disable-next-line:triple-equals
    const doesObjectExist = (await Mongo.resolve(resultObject, RequestCollection, 0)) != undefined;
    // If the object already exists we need to check for owner status
    // We skip this for annotations, since annotation ranking can be changed by owner
    // We check this in the saving strategy instead
    if (isValidObjectId && doesObjectExist && !isAnnotation(resultObject)) {
      if (!await Mongo.isUserOwnerOfObject(request, resultObject['_id'])) {
        return response.send({ status: 'error', message: 'Permission denied' });
      }
    }

    const _id = isValidObjectId
      ? new ObjectId(resultObject._id)
      : new ObjectId();
    resultObject._id = _id;

    if (isCompilation(resultObject)) {
      await saveCompilation(resultObject, userData)
        .then(compilation => resultObject = compilation)
        .catch(rejected => response.send(rejected));
    } else if (isModel(resultObject)) {
      await saveModel(resultObject, userData)
        .then(model => resultObject = model)
        .catch(rejected => response.send(rejected));
    } else if (isAnnotation(resultObject)) {
      await saveAnnotation(resultObject, userData, doesObjectExist)
        .then(annotation => resultObject = annotation)
        .catch(rejected => response.send(rejected));
    } else if (isDigitalObject(resultObject)) {
      await saveDigitalObject(resultObject)
        .then(digitalobject => {
          resultObject = digitalobject;
          Mongo.insertCurrentUserData(request, resultObject._id, 'digitalobject');
        })
        .catch(rejected => response.send(rejected));
    } else {
      await Mongo.insertCurrentUserData(request, _id, RequestCollection);
    }

    // We already got rejected. Don't update resultObject in DB
    if (response.headersSent) return;

    const updateResult = await collection
      .updateOne({ _id }, { $set: resultObject }, { upsert: true });

    if (updateResult.result.ok !== 1) {
      Logger.err(`Failed updating ${RequestCollection} ${_id}`);
      return response.send({ status: 'error' });
    }

    const resultId = (updateResult.upsertedId) ? updateResult.upsertedId._id : _id;
    response.send({ status: 'ok', ...await Mongo.resolve(resultId, RequestCollection) });
    Logger.info(`Success! Updated ${RequestCollection} ${_id}`);
  },
  updateModelSettings: async (request, response) => {
    const preview = request.body.preview;
    const identifier = (ObjectId.isValid(request.params.identifier)) ?
      new ObjectId(request.params.identifier) : request.params.identifier;
    const collection: Collection = getObjectsRepository()
      .collection('model');
    const subfolder = 'model';

    const finalImagePath = await saveBase64toImage(preview, subfolder, identifier);
    if (finalImagePath === '') {
      return response
        .send({ status: 'error', message: 'Failed saving preview image' });
    }

    // Overwrite old settings
    const settings = { ...request.body, preview: finalImagePath };
    const result = await collection.updateOne(
      { _id: identifier },
      { $set: { settings } });
    response.send((result.result.ok === 1) ? { status: 'ok', settings } : { status: 'error' });
  },
  isUserOwnerOfObject: async (request, identifier) => {
    const _id = ObjectId.isValid(identifier)
      ? new ObjectId(identifier) : identifier;
    const userData = await getCurrentUserBySession(request.sessionID);
    return JSON.stringify((userData) ? userData.data : '')
      .indexOf(_id) !== -1;
  },
  isUserAdmin: async (request): Promise<boolean> => {
    const userData = await getCurrentUserBySession(request.sessionID);
    return (userData) ? userData.role === 'A' : false;
  },
  /**
   * Simple resolving by collection name and Id
   */
  resolve: async (
    obj: any, collection_name: string, depth?: number): Promise<any | null | undefined> => {
    if (!obj) return undefined;
    const parsedId = (obj['_id']) ? obj['_id'] : obj;
    if (!ObjectId.isValid(parsedId)) return;
    const _id = new ObjectId(parsedId);
    Logger.info(`Resolving ${collection_name} ${_id}`);
    const resolve_collection: Collection = getObjectsRepository()
      .collection(collection_name);
    return resolve_collection.findOne({ $or: [ { _id }, { _id: _id.toString() } ] })
      .then(resolve_result => {
        if (depth && depth === 0) return resolve_result;

        if (isDigitalObject(resolve_result)) {
          return resolveDigitalObject(resolve_result);
        }
        if (isModel(resolve_result)) {
          return resolveModel(resolve_result);
        }
        if (isCompilation(resolve_result)) {
          return resolveCompilation(resolve_result);
        }
        return resolve_result;
      });
  },
  getObjectFromCollection: async (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();

    const _id = (ObjectId.isValid(request.params.identifier)) ?
      new ObjectId(request.params.identifier) : request.params.identifier;
    const password = (request.params.password) ? request.params.password : '';
    const object = await Mongo.resolve(_id, RequestCollection);
    if (!object) {
      return response
        .send({ status: 'error', message: `No ${RequestCollection} found with given identifier` });
    }

    if (isCompilation(object)) {
      const compilation = object;
      const _pw = compilation.password;
      const isPasswordProtected = (_pw && _pw.length > 0);
      const isUserOwner = await Mongo.isUserOwnerOfObject(request, _id);
      const isPasswordCorrect = (_pw && _pw === password);

      if (!isPasswordProtected || isUserOwner || isPasswordCorrect) {
        response.send({ status: 'ok', ...compilation });
        return;
      }

      response.send({ status: 'ok', message: 'Password protected compilation' });
    } else {
      response.send({ status: 'ok', ...object });
    }
  },
  getAllObjectsFromCollection: async (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();
    let results = await getAllItemsOfCollection(RequestCollection);

    for (let i = 0; i < results.length; i++) {
      results[i] = await Mongo.resolve(results[i], RequestCollection);
    }
    results = results.filter(_ => _);

    if (results.length > 0 && isCompilation(results[0])) {
      const isPasswordProtected = compilation =>
        (!compilation.password || (compilation.password && compilation.password.length === 0));
      results = results.filter(isPasswordProtected);
    }

    response.send(results);
  },
  removeObjectFromCollection: async (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();

    const collection = getObjectsRepository()
      .collection(RequestCollection);
    const sessionID = request.sessionID;

    const identifier = (ObjectId.isValid(request.params.identifier)) ?
      new ObjectId(request.params.identifier) : request.params.identifier;

    const find_result = await getCurrentUserBySession(sessionID);

    if (!find_result || (!find_result.username || !request.body.username)
      || (request.body.username !== find_result.username)) {
      Logger.err(`Object removal failed due to username & session not matching`);
      response.send({
        status: 'error',
        message: 'Input username does not match username with current sessionID',
      });
      return;
    }

    // Flatten account.data so its an array of ObjectId.toString()
    const UserRelatedObjects =
      Array.prototype.concat(...Object.values(find_result.data))
        .map(id => id.toString());

    if (!UserRelatedObjects.find(obj => obj === identifier.toString())) {
      Logger.err(`Object removal failed because Object does not belong to user`);
      response.send({
        status: 'error',
        message: 'Object with identifier does not belong to account with this sessionID',
      });
      return;
    }
    const delete_result = await collection.deleteOne({ _id: identifier });
    if (delete_result.result.ok === 1) {
      find_result.data[RequestCollection] =
        find_result.data[RequestCollection].filter(id => id !== identifier.toString());

      const update_result =
        await ldap()
          .updateOne({ sessionID }, { $set: { data: find_result.data } });

      if (update_result.result.ok === 1) {
        Logger.info(`Deleted ${RequestCollection} ${request.params.identifier}`);
        response.send({ status: 'ok' });
      } else {
        Logger.warn(`Failed deleting ${RequestCollection} ${request.params.identifier}`);
        response.send({ status: 'error' });
      }
    } else {
      Logger.warn(`Failed deleting ${RequestCollection} ${request.params.identifier}`);
      Logger.warn(delete_result);
      response.send({ status: 'error' });
    }
  },
  searchByObjectFilter: async (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();
    const body: any = (request.body) ? request.body : {};
    const filter: any = (body.filter) ? body.filter : {};

    const doesObjectPropertyMatch = (obj, propName, _filter = filter) => {
      if (obj[propName] === null || obj[propName] === undefined) return false;
      switch (typeof (obj[propName])) {
        case 'string':
          if (obj[propName].indexOf(_filter[propName]) === -1) return false;
          break;
        case 'object':
          switch (typeof (_filter[propName])) {
            case 'string':
              // Case: search for string inside of object
              if (JSON
                .stringify(obj[propName])
                .indexOf(_filter[propName]) === -1) return false;
              break;
            case 'object':
              // Case: recursive search inside of object + array of objects
              for (const prop in _filter[propName]) {
                if (Array.isArray(obj[propName])) {
                  let resultInArray = false;
                  for (const innerObj of obj[propName]) {
                    if (doesObjectPropertyMatch(innerObj, prop, _filter[propName])) resultInArray = true;
                  }
                  if (!resultInArray) return false;
                } else {
                  if (!doesObjectPropertyMatch(obj[propName], prop, _filter[propName])) return false;
                }
              }
              break;
            default:
              if (obj[propName] !== _filter[propName]) return false;
          }
          break;
        default:
          if (obj[propName] !== _filter[propName]) return false;
      }
      return true;
    };

    let allObjects = await getAllItemsOfCollection(RequestCollection);
    allObjects = await Promise.all(allObjects.map(obj => Mongo.resolve(obj, RequestCollection)));
    allObjects = allObjects.filter(obj => {
      for (const prop in filter) {
        if (!filter.hasOwnProperty(prop)) continue;
        if (!doesObjectPropertyMatch(obj, prop)) return false;
      }
      return true;
    });

    response.send(allObjects);
  },
  searchByTextFilter: async (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();

    const filter = (request.body.filter) ? request.body.filter.map(_ => _.toLowerCase()) : [''];
    let allObjects = await getAllItemsOfCollection(RequestCollection);

    const getNestedValues = obj => {
      let result: string[] = [];
      for (const key of Object.keys(obj)) {
        const prop = obj[key];
        if (obj.hasOwnProperty(key) && prop) {
          if (typeof (prop) === 'object' && !Array.isArray(prop)) {
            result = result.concat(getNestedValues(prop));
          } else if (typeof (prop) === 'object' && Array.isArray(prop)) {
            for (const p of prop) {
              result = result.concat(getNestedValues(p));
            }
          } else if (typeof (prop) === 'string') {
            result.push(prop);
          }
        }
      }
      return result;
    };

    const filterResults = objs => {
      const result: any[] = [];
      for (const obj of objs) {
        const asText = getNestedValues(obj)
          .join('')
          .toLowerCase();
        for (let j = 0; j < filter.length; j++) {
          if (asText.indexOf(filter[j]) === -1) {
            break;
          }
          if (j === filter.length - 1) {
            result.push(obj._id);
          }
        }
      }
      return result;
    };

    switch (RequestCollection) {
      case 'digitalobject':
        await Promise.all(allObjects.map(async digObj => Mongo.resolve(digObj, 'digitalobject')));
        break;
      case 'model':
        allObjects = allObjects.filter(model =>
          model && model.finished && model.online
          && model.relatedDigitalObject && model.relatedDigitalObject['_id']);
        for (const obj of allObjects) {
          if (obj.relatedDigitalObject['_id']) {
            const tempDigObj =
              await Mongo.resolve(obj.relatedDigitalObject, 'digitalobject');
            obj.relatedDigitalObject = await Mongo.resolve(tempDigObj, 'digitalobject');
            obj.settings.preview = '';
          }
        }
        break;
      default:
    }

    response.send(filterResults(allObjects));
  },
};

Mongo.init()
  .catch(e => Logger.err(e));

export { Mongo };
