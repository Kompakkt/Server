/* tslint:disable:max-line-length */
import { NextFunction, Request, Response } from 'express';
import { writeFileSync } from 'fs';
import { ensureDirSync } from 'fs-extra';
import * as imagemin from 'imagemin';
import * as pngquant from 'imagemin-pngquant';
import { Collection, Db, InsertOneWriteOpResult, MongoClient, ObjectId } from 'mongodb';

import { RootDirectory } from '../environment';
import { ICompilation, IEntity, ILDAPData, IMetaDataDigitalEntity } from '../interfaces';

import { Configuration } from './configuration';
import { Logger } from './logger';
import { resolveCompilation, resolveDigitalEntity, resolveEntity } from './resolving-strategies';
import { saveAnnotation, saveCompilation, saveDigitalEntity, saveEntity } from './saving-strategies';
import { isAnnotation, isCompilation, isDigitalEntity, isEntity } from './typeguards';
import { Utility } from './utility';
/* tslint:enable:max-line-length */

const MongoConf = Configuration.Mongo;
const UploadConf = Configuration.Uploads;

const ldap = (): Collection<ILDAPData> =>
  getAccountsRepository()
    .collection('users');
const getCurrentUserBySession = async (sessionID: string | undefined) => {
  if (!sessionID) return null;
  return ldap()
    .findOne({ sessionID });
};
const getUserByUsername = async (username: string) =>
  ldap()
    .findOne({ username });
const getAllItemsOfCollection = async (collection: string) =>
  getEntitiesRepository()
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
const getEntitiesRepository = (): Db => Client.db(MongoConf.RepositoryDB);

interface IMongo {
  init(): Promise<void>;
  isMongoDBConnected(_: Request, response: Response, next: NextFunction): void;
  getAccountsRepository(): Db;
  getEntitiesRepository(): Db;
  saveBase64toImage(
    base64input: string, subfolder: string,
    identifier: string | ObjectId): Promise<string>;
  fixObjectId(request: Request, _: Response, next: NextFunction): void;
  getUnusedObjectId(_: Request, response: Response): void;
  invalidateSession(request: Request, response: Response): void;
  updateSessionId(request: Request, response: Response, next: NextFunction): Promise<any>;
  addToAccounts(request: Request, response: Response): any;
  insertCurrentUserData(
    request: Request | ILDAPData,
    identifier: string | ObjectId, collection: string): Promise<any>;
  resolveUserData(_userData: ILDAPData): Promise<any>;
  getCurrentUserData(request: Request, response: Response): Promise<any>;
  validateLoginSession(request: Request, response: Response, next: NextFunction): Promise<any>;
  submitService(request: Request, response: Response): void;
  submit(request: Request, response: Response): Promise<any>;
  addEntityToCollection(request: Request, response: Response): Promise<any>;
  updateEntitySettings(request: Request, response: Response): Promise<any>;
  isUserOwnerOfEntity(request: Request | ILDAPData, identifier: string | ObjectId): Promise<any>;
  isUserAdmin(request: Request): Promise<boolean>;
  query(_id: string | ObjectId): any;
  resolve(obj: any, collection_name: string, depth?: number): Promise<any | null | undefined>;
  getEntityFromCollection(request: Request, response: Response): Promise<any>;
  getAllEntitiesFromCollection(request: Request, response: Response): Promise<any>;
  removeEntityFromCollection(request: Request, response: Response): any;
  searchByEntityFilter(request: Request, response: Response): Promise<any>;
  searchByTextFilter(request: Request, response: Response): Promise<any>;
}

const Mongo: IMongo = {
  init: async () => {
    return new Promise<void>((resolve, reject) => {
      Client.connect((error, _) => {
        if (!error) {
          resolve();
        } else {
          reject();
          Logger.err(`Couldn't connect to MongoDB.
            Make sure it is running and check your configuration`);
          process.exit(1);
        }
      });
    });
  },
  isMongoDBConnected: (_, response, next) => {
    const isConnected = Client.isConnected();
    if (isConnected) {
      next();
    } else {
      Logger.warn('Incoming request while not connected to MongoDB');
      response.send({ message: 'Cannot connect to Database. Contact sysadmin' });
    }
  },
  getAccountsRepository, getEntitiesRepository, saveBase64toImage,
  /**
   * Fix cases where an ObjectId is sent but it is not detected as one
   * used as Middleware
   */
  fixObjectId: (request, _, next) => {
    if (request) {
      if (request.body && request.body['_id'] && ObjectId.isValid(request.body['_id'])) {
        request.body['_id'] = new ObjectId(request.body['_id']);
      }
    }
    next();
  },
  getUnusedObjectId: (_, response) => {
    response.send(new ObjectId());
  },
  invalidateSession: (request, response) => {
    const sessionID = request.sessionID;
    ldap()
      .updateMany({ sessionID }, { $set: { sessionID: '' } }, () => {
        Logger.log('Logged out');
        response.send({ status: 'ok', message: 'Logged out' });
      });
  },
  updateSessionId: async (request, response, next) => {
    const user: ILDAPData = request.user;
    const username = request.body.username.toLowerCase();
    const sessionID = request.sessionID;
    const userData = await getUserByUsername(username);

    const updateResult = await ldap()
      .updateOne({ username }, {
        $set: {
          username, sessionID, ...user,
          role: (userData && userData.role)
            ? ((userData.role === '')
              ? user.role
              : userData.role)
            : user.role,
        },
      });

    if (updateResult.result.ok !== 1) {
      return response.send({ status: 'error', message: 'Failed updating user in database' });
    }
    return next();
  },
  addToAccounts: async (request, response) => {
    const user: ILDAPData = request.user;
    const username = request.body.username.toLowerCase();
    const sessionID = (request.sessionID) ? request.sessionID : null;
    const userData = await getUserByUsername(username);

    if (!sessionID) {
      response.send({ status: 'error', message: 'Failed adding sessionID' });
      return;
    }

    // Users returned by local strategy might have _id field
    // _id is immutable in MongoDB, so we can't update the field
    delete user['_id'];

    if (!userData) {
      ldap()
        .insertOne(
          {
            ...user, _id: new ObjectId(),
            username, sessionID,
            data: {},
          },
          async (ins_err, ins_res) => {
            if (ins_err) {
              response.send({ status: 'error' });
              Logger.err(ins_res);
            } else {
              Logger.info(ins_res.ops);
              const resultUser = ins_res.ops[0];
              response.send({ status: 'ok', ...await Mongo.resolveUserData(resultUser) });
            }
          });
    } else {
      ldap()
        .updateOne(
          { username },
          {
            $set: {
              ...user, sessionID,
              role: (userData.role)
                ? ((userData.role === '')
                  ? user.role
                  : userData.role)
                : user.role,
            },
          },
          (up_err, _) => {
            if (up_err) {
              response.send({ status: 'error' });
              Logger.err(up_err);
            } else {
              ldap()
                .findOne({ sessionID, username }, async (f_err, f_res) => {
                  if (f_err || !f_res) {
                    response.send({ status: 'error', message: 'Updated user not found' });
                    Logger.err(f_err, 'Updated user not found');
                  } else {
                    response.send({ status: 'ok', ...await Mongo.resolveUserData(f_res) });
                  }
                });
            }
          });
    }
  },
  insertCurrentUserData: async (request, identifier: string | ObjectId, collection: string) => {
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
  resolveUserData: async _userData => {
    const userData = {..._userData};
    if (userData.data) {
      for (const property in userData.data) {
        if (!userData.data.hasOwnProperty(property)) continue;
        userData.data[property] = await Promise.all(
          userData.data[property].map(async obj => Mongo.resolve(obj, property)));
        // Filter possible null's
        userData.data[property] = userData.data[property].filter(obj => obj);
      }
      // Add entity owners to entities
      if (userData.data.entity && userData.data.entity.length > 0) {
        for (const entity of userData.data.entity) {
          if (!entity) continue;
          if (!isEntity(entity)) continue;
          entity.relatedEntityOwners =
            await Utility.findAllEntityOwners(entity._id.toString());
        }
      }
    }
    return userData;
  },
  getCurrentUserData: async (request, response) => {
    const sessionID = request.sessionID;
    const userData = await getCurrentUserBySession(sessionID);
    if (!userData) {
      return response
        .send({ status: 'error', message: 'User not found by sessionID. Try relogging' });
    }

    return response.send({ status: 'ok', ...await Mongo.resolveUserData(userData) });
  },
  validateLoginSession: async (request, response, next) => {
    let cookieSID: string | undefined;
    if (request.cookies['connect.sid']) {
      cookieSID = request.cookies['connect.sid'] as string;
      const startIndex = cookieSID.indexOf(':') + 1;
      const endIndex = cookieSID.indexOf('.');
      cookieSID = cookieSID.substring(startIndex, endIndex);
    }
    const sessionID = request.sessionID = (cookieSID) ?
      cookieSID : request.sessionID;

    const userData = await getCurrentUserBySession(sessionID);
    if (!userData) {
      return response.send({ status: 'error', message: 'Invalid session' });
    }
    return next();
  },
  submitService: (request, response) => {
    const digobjCollection: Collection<IMetaDataDigitalEntity> =
      getEntitiesRepository()
        .collection('digitalentity');
    const entityCollection: Collection<IEntity> =
      getEntitiesRepository()
        .collection('entity');

    const service: string = request.params.service;
    if (!service) response.send({ status: 'error', message: 'Incorrect request' });

    const mapTypes = (resType: string) => {
      let type = resType;
      type = type.toLowerCase();
      switch (type) {
        case 'sound': type = 'audio'; break;
        case 'picture': type = 'image'; break;
        case '3d': type = 'entity'; break;
        default:
      }
      return type;
    };

    // After adding a digitalentity inside of a entity,
    // attach data to the current user
    const insertFinalEntityToCurrentUser = (entityResult: InsertOneWriteOpResult) => {
      Mongo.insertCurrentUserData(request, entityResult.ops[0]._id, 'entity')
        .then(() => {
          response.send({ status: 'ok', result: entityResult.ops[0] });
          Logger.info(`Added Europeana entity ${entityResult.ops[0]._id}`);
        })
        .catch(err => {
          Logger.err(err);
          response.send({ status: 'error', message: 'Failed adding finalized entity to user' });
        });
    };

    // After adding a digitalentity, add digitalentity
    // to a entity and push the entity
    const pushEntity = (digobjResult: InsertOneWriteOpResult) => {
      const resultEntity = digobjResult.ops[0];
      const entityEntity: IEntity = {
        _id: new ObjectId(),
        annotationList: [],
        relatedDigitalEntity: {
          _id: resultEntity._id,
        },
        name: resultEntity.digobj_title,
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
      entityCollection.insertOne(entityEntity)
        .then(insertFinalEntityToCurrentUser)
        .catch(err => {
          Logger.err(err);
          response.send({ status: 'error', message: 'Failed finalizing digitalentity' });
        });
    };

    switch (service) {
      case 'europeana':
        // TODO: Put into Europeana service to make every service self sustained?
        const EuropeanaEntity: IMetaDataDigitalEntity = {
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
          digobj_entitytype: '',
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

        digobjCollection.insertOne(EuropeanaEntity)
          .then(pushEntity)
          .catch(err => {
            Logger.err(err);
            response.send({ status: 'error', message: `Couldn't add as digitalentity` });
          });

        break;
      default:
        response.send({ status: 'error', message: `Service ${service} not configured` });
    }
  },
  /**
   * DEPRECATED: Redirects to correct function though!
   * When the user submits the metadataform this function
   * adds the missing data to defined collections
   */
  submit: async (request, response) => {
    Logger.info('Handling submit request');
    request.params.collection = 'digitalentity';
    await Mongo.addEntityToCollection(request, response);
  },
  addEntityToCollection: async (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();

    Logger.info(`Adding to the following collection: ${RequestCollection}`);

    const collection: Collection = getEntitiesRepository()
      .collection(RequestCollection);

    let resultEntity = request.body;
    const userData = await getCurrentUserBySession(request.sessionID);
    if (!userData) {
      return response
        .send({ status: 'error', message: 'Cannot fetch current user from database' });
    }

    const isValidObjectId = ObjectId.isValid(resultEntity['_id']);
    // tslint:disable-next-line:triple-equals
    const doesEntityExist = (await Mongo.resolve(resultEntity, RequestCollection, 0)) != undefined;
    // If the entity already exists we need to check for owner status
    // We skip this for annotations, since annotation ranking can be changed by owner
    // We check this in the saving strategy instead
    if (isValidObjectId && doesEntityExist && !isAnnotation(resultEntity)) {
      if (!await Mongo.isUserOwnerOfEntity(request, resultEntity['_id'])) {
        return response.send({ status: 'error', message: 'Permission denied' });
      }
    }

    const _id = isValidObjectId
      ? new ObjectId(resultEntity._id)
      : new ObjectId();
    resultEntity._id = _id;

    if (isCompilation(resultEntity)) {
      await saveCompilation(resultEntity, userData)
        .then(compilation => resultEntity = compilation)
        .catch(rejected => response.send(rejected));
    } else if (isEntity(resultEntity)) {
      await saveEntity(resultEntity, userData)
        .then(entity => resultEntity = entity)
        .catch(rejected => response.send(rejected));
    } else if (isAnnotation(resultEntity)) {
      await saveAnnotation(resultEntity, userData, doesEntityExist)
        .then(annotation => resultEntity = annotation)
        .catch(rejected => response.send(rejected));
    } else if (isDigitalEntity(resultEntity)) {
      await saveDigitalEntity(resultEntity)
        .then(async digitalentity => {
          resultEntity = digitalentity;
          await Mongo
            .insertCurrentUserData(request, resultEntity._id, 'digitalentity');
        })
        .catch(rejected => response.send(rejected));
    } else {
      await Mongo.insertCurrentUserData(request, _id, RequestCollection);
    }

    // We already got rejected. Don't update resultEntity in DB
    if (response.headersSent) return undefined;

    const updateResult = await collection
      .updateOne({ _id }, { $set: resultEntity }, { upsert: true });

    if (updateResult.result.ok !== 1) {
      Logger.err(`Failed updating ${RequestCollection} ${_id}`);
      return response.send({ status: 'error' });
    }

    const resultId = (updateResult.upsertedId) ? updateResult.upsertedId._id : _id;
    Logger.info(`Success! Updated ${RequestCollection} ${_id}`);
    return response.send({ status: 'ok', ...await Mongo.resolve(resultId, RequestCollection) });
  },
  updateEntitySettings: async (request, response) => {
    const preview = request.body.preview;
    const identifier = (ObjectId.isValid(request.params.identifier)) ?
      new ObjectId(request.params.identifier) : request.params.identifier;
    const collection: Collection = getEntitiesRepository()
      .collection('entity');
    const subfolder = 'entity';

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
    return response
      .send((result.result.ok === 1) ? { status: 'ok', settings } : { status: 'error' });
  },
  isUserOwnerOfEntity: async (request, identifier: string | ObjectId) => {
    const _id = ObjectId.isValid(identifier)
      ? new ObjectId(identifier) : identifier;
    const userData = await getCurrentUserBySession(request.sessionID);
    return JSON.stringify((userData) ? userData.data : '')
      .indexOf(_id.toString()) !== -1;
  },
  isUserAdmin: async (request): Promise<boolean> => {
    const userData = await getCurrentUserBySession(request.sessionID);
    return (userData) ? userData.role === 'A' : false;
  },
  query: (_id: string | ObjectId) => {
    return {
      $or: [
        { _id },
        { _id: new ObjectId(_id) },
        { _id: _id.toString() },
      ],
    };
  },
  resolve: async (
    obj: any, collection_name: string, depth?: number): Promise<any | null | undefined> => {
    if (!obj) return undefined;
    const parsedId = (obj['_id']) ? obj['_id'] : obj;
    if (!ObjectId.isValid(parsedId)) return undefined;
    const _id = new ObjectId(parsedId);
    Logger.info(`Resolving ${collection_name} ${_id}`);
    const resolve_collection: Collection = getEntitiesRepository()
      .collection(collection_name);
    return resolve_collection.findOne(Mongo.query(_id))
      .then(resolve_result => {
        if (depth && depth === 0) return resolve_result;

        if (isDigitalEntity(resolve_result)) {
          return resolveDigitalEntity(resolve_result);
        }
        if (isEntity(resolve_result)) {
          return resolveEntity(resolve_result);
        }
        if (isCompilation(resolve_result)) {
          return resolveCompilation(resolve_result);
        }
        return resolve_result;
      });
  },
  getEntityFromCollection: async (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();

    const _id = (ObjectId.isValid(request.params.identifier)) ?
      new ObjectId(request.params.identifier) : request.params.identifier;
    const password = (request.params.password) ? request.params.password : '';
    const entity = await Mongo.resolve(_id, RequestCollection);
    if (!entity) {
      return response
        .send({ status: 'error', message: `No ${RequestCollection} found with given identifier` });
    }

    if (isCompilation(entity)) {
      const compilation = entity;
      const _pw = compilation.password;
      const isPasswordProtected = (_pw && _pw.length > 0);
      const isUserOwner = await Mongo.isUserOwnerOfEntity(request, _id);
      const isPasswordCorrect = (_pw && _pw === password);

      if (!isPasswordProtected || isUserOwner || isPasswordCorrect) {
        response.send({ status: 'ok', ...compilation });
        return undefined;
      }

      return response.send({ status: 'ok', message: 'Password protected compilation' });
    }
    return response.send({ status: 'ok', ...entity });
  },
  getAllEntitiesFromCollection: async (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();
    let results = await getAllItemsOfCollection(RequestCollection);

    for (let i = 0; i < results.length; i++) {
      results[i] = await Mongo.resolve(results[i], RequestCollection);
    }
    results = results.filter(_ => _);

    if (results.length > 0 && isCompilation(results[0])) {
      const isPasswordProtected = (compilation: ICompilation) =>
        (!compilation.password || (compilation.password && compilation.password.length === 0));
      results = results.filter(isPasswordProtected);
    }

    response.send(results);
  },
  removeEntityFromCollection: async (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();

    const collection = getEntitiesRepository()
      .collection(RequestCollection);
    const sessionID = request.sessionID;

    const identifier = (ObjectId.isValid(request.params.identifier)) ?
      new ObjectId(request.params.identifier) : request.params.identifier;

    const find_result = await getCurrentUserBySession(sessionID);

    if (!find_result || (!find_result.username || !request.body.username)
      || (request.body.username !== find_result.username)) {
      Logger.err(`Entity removal failed due to username & session not matching`);
      response.send({
        status: 'error',
        message: 'Input username does not match username with current sessionID',
      });
      return;
    }

    // Flatten account.data so its an array of ObjectId.toString()
    const UserRelatedEntities =
      Array.prototype.concat(...Object.values(find_result.data))
        .map(id => id.toString());

    if (!UserRelatedEntities.find(obj => obj === identifier.toString())) {
      Logger.err(`Entity removal failed because Entity does not belong to user`);
      response.send({
        status: 'error',
        message: 'Entity with identifier does not belong to account with this sessionID',
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
  searchByEntityFilter: async (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();
    const body: any = (request.body) ? request.body : {};
    const filter: any = (body.filter) ? body.filter : {};

    const doesEntityPropertyMatch = (obj: any, propName: string, _filter = filter) => {
      if (obj[propName] === null || obj[propName] === undefined) return false;
      switch (typeof (obj[propName])) {
        case 'string':
          if (obj[propName].indexOf(_filter[propName]) === -1) return false;
          break;
        case 'object':
          switch (typeof (_filter[propName])) {
            case 'string':
              // Case: search for string inside of entity
              if (JSON
                .stringify(obj[propName])
                .indexOf(_filter[propName]) === -1) return false;
              break;
            case 'object':
              // Case: recursive search inside of entity + array of entities
              for (const prop in _filter[propName]) {
                if (Array.isArray(obj[propName])) {
                  let resultInArray = false;
                  for (const innerObj of obj[propName]) {
                    if (doesEntityPropertyMatch(innerObj, prop, _filter[propName])) {
                      resultInArray = true;
                    }
                  }
                  if (!resultInArray) return false;
                } else {
                  if (!doesEntityPropertyMatch(obj[propName], prop, _filter[propName])) {
                    return false;
                  }
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

    let allEntities = await getAllItemsOfCollection(RequestCollection);
    allEntities = await Promise.all(allEntities.map(obj => Mongo.resolve(obj, RequestCollection)));
    allEntities = allEntities.filter(obj => {
      for (const prop in filter) {
        if (!filter.hasOwnProperty(prop)) continue;
        if (!doesEntityPropertyMatch(obj, prop)) return false;
      }
      return true;
    });

    response.send(allEntities);
  },
  searchByTextFilter: async (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();

    const filter = (request.body.filter)
      ? request.body.filter.map((_: any) => _.toLowerCase())
      : [''];
    let allEntities = await getAllItemsOfCollection(RequestCollection);

    const getNestedValues = (obj: any) => {
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

    const filterResults = (objs: any[]) => {
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
      case 'digitalentity':
        await Promise.all(allEntities.map(async digObj => Mongo.resolve(digObj, 'digitalentity')));
        break;
      case 'entity':
        allEntities = allEntities.filter(entity =>
          entity && entity.finished && entity.online
          && entity.relatedDigitalEntity && entity.relatedDigitalEntity['_id']);
        for (const obj of allEntities) {
          if (obj.relatedDigitalEntity['_id']) {
            const tempDigObj =
              await Mongo.resolve(obj.relatedDigitalEntity, 'digitalentity');
            obj.relatedDigitalEntity = await Mongo.resolve(tempDigObj, 'digitalentity');
            obj.settings.preview = '';
          }
        }
        break;
      default:
    }

    response.send(filterResults(allEntities));
  },
};

Mongo.init()
  .catch(e => Logger.err(e));

export { Mongo };
