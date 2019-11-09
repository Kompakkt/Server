/* tslint:disable:max-line-length */
import { NextFunction, Request, Response } from 'express';
import { writeFileSync } from 'fs';
import { ensureDirSync } from 'fs-extra';
import * as imagemin from 'imagemin';
import * as pngquant from 'imagemin-pngquant';
import { Collection, Db, MongoClient, ObjectId } from 'mongodb';

import { RootDirectory } from '../environment';
import { ICompilation, IEntity, IUserData, EUserRank } from '../interfaces';

import { Configuration } from './configuration';
import { Logger } from './logger';
import {
  resolveCompilation,
  resolveDigitalEntity,
  resolveEntity,
  resolvePerson,
} from './resolving-strategies';
import {
  saveAnnotation,
  saveCompilation,
  saveDigitalEntity,
  saveEntity,
  savePerson,
  saveInstitution,
} from './saving-strategies';
import {
  isAnnotation,
  isCompilation,
  isDigitalEntity,
  isEntity,
  isPerson,
  isInstitution,
} from './typeguards';
import { Utility } from './utility';
/* tslint:enable:max-line-length */

interface IExploreRequest {
  searchEntity: boolean;
  types: string[];
  filters: {
    annotatable: boolean;
    annotated: boolean;
    restricted: boolean;
    associated: boolean;
  };
  searchText: string;
  offset: number;
}

const MongoConf = Configuration.Mongo;
const UploadConf = Configuration.Uploads;

const users = (): Collection<IUserData> =>
  getAccountsRepository().collection('users');
const getCurrentUserBySession = async (sessionID: string | undefined) => {
  if (!sessionID) return null;
  return users().findOne({ sessionID });
};
const getUserByUsername = async (username: string) =>
  users().findOne({ username });
const getAllItemsOfCollection = async (collection: string) =>
  getEntitiesRepository()
    .collection(collection)
    .find({})
    .toArray();

const areObjectIdsEqual = (
  firstId: string | ObjectId,
  secondId: string | ObjectId,
) => new ObjectId(firstId).toString() === new ObjectId(secondId).toString();

const saveBase64toImage = async (
  base64input: string,
  subfolder: string,
  identifier: string | ObjectId,
) => {
  const saveId = identifier.toString();
  let finalImagePath = '';
  // TODO: Solve without try-catch block
  // TODO: Convert to progressive JPEG?
  try {
    if (base64input.indexOf('data:image') !== -1) {
      const replaced = base64input.replace(
        /^data:image\/(png|gif|jpeg);base64,/,
        '',
      );
      const tempBuff = Buffer.from(replaced, 'base64');
      await imagemin
        .buffer(tempBuff, {
          plugins: [
            pngquant.default({
              speed: 1,
              strip: true,
              dithering: 1,
            }),
          ],
        })
        .then(res => {
          ensureDirSync(
            `${RootDirectory}/${UploadConf.UploadDirectory}/previews/${subfolder}/`,
          );
          writeFileSync(
            `${RootDirectory}/${UploadConf.UploadDirectory}/previews/${subfolder}/${saveId}.png`,
            res,
          );

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
    base64input: string,
    subfolder: string,
    identifier: string | ObjectId,
  ): Promise<string>;
  fixObjectId(request: Request, _: Response, next: NextFunction): void;
  getUnusedObjectId(_: Request, response: Response): void;
  invalidateSession(request: Request, response: Response): void;
  updateSessionId(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<any>;
  addToAccounts(request: Request, response: Response): any;
  insertCurrentUserData(
    request: Request | IUserData,
    identifier: string | ObjectId,
    collection: string,
  ): Promise<any>;
  resolveUserData(_userData: IUserData): Promise<IUserData>;
  getCurrentUserData(request: Request, response: Response): Promise<any>;
  validateLoginSession(
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<any>;
  submit(request: Request, response: Response): Promise<any>;
  addEntityToCollection(request: Request, response: Response): Promise<any>;
  updateEntitySettings(request: Request, response: Response): Promise<any>;
  isUserOwnerOfEntity(
    request: Request | IUserData,
    identifier: string | ObjectId,
  ): Promise<any>;
  isUserAdmin(request: Request): Promise<boolean>;
  query(_id: string | ObjectId): any;
  resolve(
    obj: any,
    collection_name: string,
    depth?: number,
  ): Promise<any | null | undefined>;
  getEntityFromCollection(request: Request, response: Response): Promise<any>;
  getAllEntitiesFromCollection(
    request: Request,
    response: Response,
  ): Promise<any>;
  removeEntityFromCollection(request: Request, response: Response): any;
  searchByEntityFilter(request: Request, response: Response): Promise<any>;
  searchByTextFilter(request: Request, response: Response): Promise<any>;
  explore(request: Request, response: Response): Promise<any>;
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
      response.send({
        message: 'Cannot connect to Database. Contact sysadmin',
      });
    }
  },
  getAccountsRepository,
  getEntitiesRepository,
  saveBase64toImage,
  /**
   * Fix cases where an ObjectId is sent but it is not detected as one
   * used as Middleware
   */
  fixObjectId: (request, _, next) => {
    if (request) {
      if (
        request.body &&
        request.body['_id'] &&
        ObjectId.isValid(request.body['_id'])
      ) {
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
    users().updateMany({ sessionID }, { $set: { sessionID: '' } }, () => {
      Logger.log('Logged out');
      response.send({ status: 'ok', message: 'Logged out' });
    });
  },
  updateSessionId: async (request, response, next) => {
    const username = request.body.username.toLowerCase();
    const userData = await getUserByUsername(username);

    if (!userData) {
      return response.send({
        status: 'error',
        message: 'Failed finding user with username',
      });
    }

    const sessionID = request.sessionID;

    const updateResult = await users().updateOne(
      { username },
      {
        $set: {
          ...userData,
          username,
          sessionID,
        },
      },
    );

    if (updateResult.result.ok !== 1) {
      return response.send({
        status: 'error',
        message: 'Failed updating user in database',
      });
    }
    return next();
  },
  addToAccounts: async (request, response) => {
    const user: IUserData = request.user as IUserData;
    const username = request.body.username.toLowerCase();
    const sessionID = request.sessionID ? request.sessionID : null;
    const userData = await getUserByUsername(username);

    if (!sessionID) {
      response.send({ status: 'error', message: 'Failed adding sessionID' });
      return;
    }

    const updatedUser: IUserData = {
      ...user,
      username,
      sessionID,
      data: userData ? userData.data : {},
      role: userData ? userData.role : EUserRank.user,
    };

    // Users returned by local strategy might have _id field
    // _id is immutable in MongoDB, so we can't update the field
    delete updatedUser['_id'];

    users()
      .updateOne({ username }, { $set: updatedUser }, { upsert: true })
      .then(async _ => {
        Logger.log(`User ${updatedUser.username} logged in`);
        response.send({
          status: 'ok',
          ...(await Mongo.resolveUserData(updatedUser)),
        });
      })
      .catch(error => {
        Logger.err(error);
        response.send({
          status: 'error',
          message: 'Failed updating user entry in database',
        });
      });
  },
  insertCurrentUserData: async (
    request,
    identifier: string | ObjectId,
    collection: string,
  ) => {
    const sessionID = request.sessionID;
    const userData = await getCurrentUserBySession(sessionID);

    if (!ObjectId.isValid(identifier) || !userData) return false;

    userData.data[collection] = userData.data[collection]
      ? userData.data[collection]
      : [];

    const doesExist = userData.data[collection]
      .filter(obj => obj)
      .find((obj: any) => obj.toString() === identifier.toString());

    if (doesExist) return true;

    userData.data[collection].push(new ObjectId(identifier));
    const updateResult = await users().updateOne(
      { sessionID },
      { $set: { data: userData.data } },
    );

    if (updateResult.result.ok !== 1) return false;
    return true;
  },
  resolveUserData: async _userData => {
    const userData = { ..._userData };
    if (userData.data) {
      for (const property in userData.data) {
        if (!userData.data.hasOwnProperty(property)) continue;
        userData.data[property] = await Promise.all(
          userData.data[property].map(async obj =>
            Mongo.resolve(obj, property),
          ),
        );
        // Filter possible null's
        userData.data[property] = userData.data[property].filter(obj => obj);
      }
      // Add entity owners to entities
      if (userData.data.entity?.length > 0) {
        for (const entity of userData.data.entity) {
          if (!entity) continue;
          if (!isEntity(entity)) continue;
          entity.relatedEntityOwners = await Utility.findAllEntityOwners(
            entity._id.toString(),
          );
        }
      }
    }
    return userData;
  },
  getCurrentUserData: async (request, response) => {
    const sessionID = request.sessionID;
    const userData = await getCurrentUserBySession(sessionID);
    if (!userData) {
      return response.send({
        status: 'error',
        message: 'User not found by sessionID. Try relogging',
      });
    }

    return response.send({
      status: 'ok',
      ...(await Mongo.resolveUserData(userData)),
    });
  },
  validateLoginSession: async (request, response, next) => {
    let cookieSID: string | undefined;
    if (request.cookies['connect.sid']) {
      cookieSID = request.cookies['connect.sid'] as string;
      const startIndex = cookieSID.indexOf(':') + 1;
      const endIndex = cookieSID.indexOf('.');
      cookieSID = cookieSID.substring(startIndex, endIndex);
    }
    const sessionID = (request.sessionID = cookieSID
      ? cookieSID
      : request.sessionID);

    const userData = await getCurrentUserBySession(sessionID);
    if (!userData) {
      return response.send({ status: 'error', message: 'Invalid session' });
    }
    return next();
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

    const collection: Collection = getEntitiesRepository().collection(
      RequestCollection,
    );

    let resultEntity = request.body;
    const userData = await getCurrentUserBySession(request.sessionID);
    if (!userData) {
      return response.send({
        status: 'error',
        message: 'Cannot fetch current user from database',
      });
    }

    const isValidObjectId = ObjectId.isValid(resultEntity['_id']);
    // tslint:disable-next-line:triple-equals
    const doesEntityExist =
      (await Mongo.resolve(resultEntity, RequestCollection, 0)) != undefined;

    /**
     * If the entity already exists we need to check for owner status
     * We skip this for annotations, since annotation ranking can be changed by owner
     * We check this in the saving strategy instead
     * We also skip this for persons and institutions since their nested content
     * (addresses, contact_references, etc.) can also be updated
     */
    const isAllowedType = (_e: any) =>
      isAnnotation(_e) || isPerson(_e) || isInstitution(_e);

    if (isValidObjectId && doesEntityExist && !isAllowedType(resultEntity)) {
      if (!(await Mongo.isUserOwnerOfEntity(request, resultEntity['_id']))) {
        return response.send({ status: 'error', message: 'Permission denied' });
      }
    }

    const _id = isValidObjectId
      ? new ObjectId(resultEntity._id)
      : new ObjectId();
    resultEntity._id = _id;

    if (isCompilation(resultEntity)) {
      await saveCompilation(resultEntity, userData)
        .then(compilation => (resultEntity = compilation))
        .catch(rejected => response.send(rejected));
    } else if (isEntity(resultEntity)) {
      await saveEntity(resultEntity, userData)
        .then(entity => (resultEntity = entity))
        .catch(rejected => response.send(rejected));
    } else if (isAnnotation(resultEntity)) {
      await saveAnnotation(resultEntity, userData, doesEntityExist)
        .then(annotation => (resultEntity = annotation))
        .catch(rejected => response.send(rejected));
    } else if (isPerson(resultEntity)) {
      await savePerson(resultEntity, userData)
        .then(person => (resultEntity = person))
        .catch(rejected => response.send(rejected));
    } else if (isInstitution(resultEntity)) {
      await saveInstitution(resultEntity, userData)
        .then(institution => (resultEntity = institution))
        .catch(rejected => response.send(rejected));
    } else if (isDigitalEntity(resultEntity)) {
      await saveDigitalEntity(resultEntity, userData)
        .then(async digitalentity => {
          resultEntity = digitalentity;
          await Mongo.insertCurrentUserData(
            request,
            resultEntity._id,
            'digitalentity',
          );
        })
        .catch(rejected => response.send(rejected));
    } else {
      await Mongo.insertCurrentUserData(request, _id, RequestCollection);
    }

    // We already got rejected. Don't update resultEntity in DB
    if (response.headersSent) return undefined;

    const updateResult = await collection.updateOne(
      { _id },
      { $set: resultEntity },
      { upsert: true },
    );

    if (updateResult.result.ok !== 1) {
      Logger.err(`Failed updating ${RequestCollection} ${_id}`);
      return response.send({ status: 'error' });
    }

    const resultId = updateResult.upsertedId
      ? updateResult.upsertedId._id
      : _id;
    Logger.info(`Success! Updated ${RequestCollection} ${_id}`);
    return response.send({
      status: 'ok',
      ...(await Mongo.resolve(resultId, RequestCollection)),
    });
  },
  updateEntitySettings: async (request, response) => {
    const preview = request.body.preview;
    const identifier = ObjectId.isValid(request.params.identifier)
      ? new ObjectId(request.params.identifier)
      : request.params.identifier;
    const collection: Collection = getEntitiesRepository().collection('entity');
    const subfolder = 'entity';

    const finalImagePath = await saveBase64toImage(
      preview,
      subfolder,
      identifier,
    );
    if (finalImagePath === '') {
      return response.send({
        status: 'error',
        message: 'Failed saving preview image',
      });
    }

    // Overwrite old settings
    const settings = { ...request.body, preview: finalImagePath };
    const result = await collection.updateOne(
      { _id: identifier },
      { $set: { settings } },
    );
    return response.send(
      result.result.ok === 1 ? { status: 'ok', settings } : { status: 'error' },
    );
  },
  isUserOwnerOfEntity: async (request, identifier: string | ObjectId) => {
    const _id = ObjectId.isValid(identifier)
      ? new ObjectId(identifier)
      : identifier;
    const userData = await getCurrentUserBySession(request.sessionID);
    if (!userData) {
      return false;
    }
    const resolvedUser = await Mongo.resolveUserData(userData);
    return (
      JSON.stringify(resolvedUser ? resolvedUser.data : '').indexOf(
        _id.toString(),
      ) !== -1
    );
  },
  isUserAdmin: async (request): Promise<boolean> => {
    const userData = await getCurrentUserBySession(request.sessionID);
    return userData ? userData.role === EUserRank.admin : false;
  },
  query: (_id: string | ObjectId) => {
    return {
      $or: [{ _id }, { _id: new ObjectId(_id) }, { _id: _id.toString() }],
    };
  },
  resolve: async (
    obj: any,
    collection_name: string,
    depth?: number,
  ): Promise<any | null | undefined> => {
    if (!obj) return undefined;
    const parsedId = obj['_id'] ? obj['_id'] : obj;
    if (!ObjectId.isValid(parsedId)) return undefined;
    const _id = new ObjectId(parsedId);
    const resolve_collection: Collection = getEntitiesRepository().collection(
      collection_name,
    );
    return resolve_collection
      .findOne(Mongo.query(_id))
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
        if (isPerson(resolve_result)) {
          return resolvePerson(resolve_result);
        }
        return resolve_result;
      })
      .catch(err => {
        Logger.warn(
          `Encountered error trying to resolve ${parsedId} in ${collection_name}`,
        );
        Logger.err(err);
        return undefined;
      });
  },
  getEntityFromCollection: async (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();

    const _id = ObjectId.isValid(request.params.identifier)
      ? new ObjectId(request.params.identifier)
      : request.params.identifier;
    const password = request.params.password ? request.params.password : '';
    const entity = await Mongo.resolve(_id, RequestCollection);
    if (!entity) {
      return response.send({
        status: 'error',
        message: `No ${RequestCollection} found with given identifier`,
      });
    }

    if (isCompilation(entity)) {
      const compilation = entity;
      const _pw = compilation.password;
      const isPasswordProtected = _pw && _pw !== '';
      const isUserOwner = await Mongo.isUserOwnerOfEntity(request, _id);
      const isPasswordCorrect = _pw && _pw === password;

      if (!isPasswordProtected || isUserOwner || isPasswordCorrect) {
        response.send({ status: 'ok', ...compilation });
        return undefined;
      }

      return response.send({
        status: 'ok',
        message: 'Password protected compilation',
      });
    }
    return response.send({ status: 'ok', ...entity });
  },
  getAllEntitiesFromCollection: async (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();
    const allowed = ['person', 'institution', 'tag'];
    if (!allowed.includes(RequestCollection)) {
      response.send([]);
      return;
    }

    let results = await getAllItemsOfCollection(RequestCollection);

    for (let i = 0; i < results.length; i++) {
      results[i] = await Mongo.resolve(results[i], RequestCollection);
    }
    results = results.filter(_ => _);

    response.send(results);
  },
  removeEntityFromCollection: async (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();

    const collection = getEntitiesRepository().collection(RequestCollection);
    const sessionID = request.sessionID;

    const identifier = ObjectId.isValid(request.params.identifier)
      ? new ObjectId(request.params.identifier)
      : request.params.identifier;

    const find_result = await getCurrentUserBySession(sessionID);

    if (
      !find_result ||
      !find_result.username ||
      !request.body.username ||
      request.body.username !== find_result.username
    ) {
      Logger.err(
        `Entity removal failed due to username & session not matching`,
      );
      response.send({
        status: 'error',
        message:
          'Input username does not match username with current sessionID',
      });
      return;
    }

    // Flatten account.data so its an array of ObjectId.toString()
    const UserRelatedEntities = Array.prototype
      .concat(...Object.values(find_result.data))
      .map(id => id.toString());

    if (!UserRelatedEntities.find(obj => obj === identifier.toString())) {
      Logger.err(
        `Entity removal failed because Entity does not belong to user`,
      );
      response.send({
        status: 'error',
        message:
          'Entity with identifier does not belong to account with this sessionID',
      });
      return;
    }
    const delete_result = await collection.deleteOne({ _id: identifier });
    if (delete_result.result.ok === 1) {
      find_result.data[RequestCollection] = find_result.data[
        RequestCollection
      ].filter(id => id !== identifier.toString());

      const update_result = await users().updateOne(
        { sessionID },
        { $set: { data: find_result.data } },
      );

      if (update_result.result.ok === 1) {
        Logger.info(
          `Deleted ${RequestCollection} ${request.params.identifier}`,
        );
        response.send({ status: 'ok' });
      } else {
        Logger.warn(
          `Failed deleting ${RequestCollection} ${request.params.identifier}`,
        );
        response.send({ status: 'error' });
      }
    } else {
      Logger.warn(
        `Failed deleting ${RequestCollection} ${request.params.identifier}`,
      );
      Logger.warn(delete_result);
      response.send({ status: 'error' });
    }
  },
  searchByEntityFilter: async (request, response) => {
    const RequestCollection = request.params.collection.toLowerCase();
    const body: any = request.body ? request.body : {};
    const filter: any = body.filter ? body.filter : {};

    const doesEntityPropertyMatch = (
      obj: any,
      propName: string,
      _filter = filter,
    ) => {
      if (obj[propName] === null || obj[propName] === undefined) return false;
      switch (typeof obj[propName]) {
        case 'string':
          if (obj[propName].indexOf(_filter[propName]) === -1) return false;
          break;
        case 'object':
          switch (typeof _filter[propName]) {
            case 'string':
              // Case: search for string inside of entity
              if (
                JSON.stringify(obj[propName]).indexOf(_filter[propName]) === -1
              )
                return false;
              break;
            case 'object':
              // Case: recursive search inside of entity + array of entities
              for (const prop in _filter[propName]) {
                if (Array.isArray(obj[propName])) {
                  let resultInArray = false;
                  for (const innerObj of obj[propName]) {
                    if (
                      doesEntityPropertyMatch(innerObj, prop, _filter[propName])
                    ) {
                      resultInArray = true;
                    }
                  }
                  if (!resultInArray) return false;
                } else {
                  if (
                    !doesEntityPropertyMatch(
                      obj[propName],
                      prop,
                      _filter[propName],
                    )
                  ) {
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
    allEntities = await Promise.all(
      allEntities.map(obj => Mongo.resolve(obj, RequestCollection)),
    );
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

    const filter = request.body.filter
      ? request.body.filter.map((_: any) => _.toLowerCase())
      : [''];
    const offset = request.body.offset ? parseInt(request.body.offset, 10) : 0;
    const length = 20;

    if (typeof offset !== 'number') {
      response.send({ status: 'error', message: 'Offset is not a number' });
      return;
    }

    if (offset < 0) {
      response.send({ status: 'error', message: 'Offset is smaller than 0' });
      return;
    }

    let allEntities = (await getAllItemsOfCollection(RequestCollection)).slice(
      offset,
      offset + length,
    );
    allEntities = await Promise.all(
      allEntities.map(obj => Mongo.resolve(obj, RequestCollection)),
    );

    const getNestedValues = (obj: any) => {
      let result: string[] = [];
      for (const key of Object.keys(obj)) {
        const prop = obj[key];
        if (obj.hasOwnProperty(key) && prop) {
          if (typeof prop === 'object' && !Array.isArray(prop)) {
            result = result.concat(getNestedValues(prop));
          } else if (typeof prop === 'object' && Array.isArray(prop)) {
            for (const p of prop) {
              result = result.concat(getNestedValues(p));
            }
          } else if (typeof prop === 'string') {
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
            result.push(obj);
          }
        }
      }
      return result;
    };

    response.send(filterResults(allEntities));
  },
  explore: async (request, response) => {
    const {
      types,
      offset,
      searchEntity,
      filters,
      searchText,
    } = request.body as IExploreRequest;
    const items = new Array<IEntity | ICompilation>();
    const limit = 20;
    const userData = await getCurrentUserBySession(request.sessionID);
    const userOwned = userData ? JSON.stringify(userData.data) : '';

    if (searchEntity) {
      const cursor = await Mongo.getEntitiesRepository()
        .collection<IEntity>('entity')
        .find({
          finished: true,
          online: true,
          mediaType: {
            $in: types,
          },
        })
        .sort({
          name: 1,
        })
        .skip(offset);

      const entities: IEntity[] = [];

      const canContinue = async () =>
        (await cursor.hasNext()) &&
        !cursor.isClosed() &&
        entities.length < limit &&
        types.length > 0;

      while (await canContinue()) {
        const _entity = await cursor.next();
        if (!_entity) continue;

        const isOwner = userOwned.includes(_entity._id.toString());
        const metadata = JSON.stringify(_entity).toLowerCase();

        const isAnnotatable = isOwner; // only owner can set default annotations
        if (filters.annotatable && !isAnnotatable) continue;

        const isAnnotated = _entity.annotationList.length > 0;
        if (filters.annotated && !isAnnotated) continue;

        let isRestricted = false;
        // Whitelist visibility filter
        if (_entity.whitelist.enabled) {
          if (!userData) continue;
          // TODO: manual checking instead of JSON.stringify
          const isWhitelisted = JSON.stringify(_entity.whitelist).includes(
            userData._id.toString(),
          );
          if (!isOwner && !isWhitelisted) continue;
          isRestricted = true;
        }
        if (filters.restricted && !isRestricted) continue;

        const isAssociated = userData // user appears in metadata
          ? metadata.includes(userData.fullname.toLowerCase()) ||
            metadata.includes(userData.mail.toLowerCase())
          : false;
        if (filters.associated && !isAssociated) continue;

        // Search text filter
        if (searchText !== '' && !metadata.includes(searchText)) {
          continue;
        }

        entities.push(await Mongo.resolve(_entity, 'entity'));
      }

      items.push(...entities);
    } else {
      const cursor = await Mongo.getEntitiesRepository()
        .collection<ICompilation>('compilation')
        .find({})
        .sort({
          name: 1,
        })
        .skip(offset);
      const compilations: ICompilation[] = [];

      const canContinue = () =>
        cursor.hasNext() && !cursor.isClosed() && compilations.length < limit;

      while (canContinue()) {
        const _comp = await cursor.next();
        if (!_comp) continue;
        const resolved: ICompilation = await Mongo.resolve(
          _comp,
          'compilation',
        );

        if (searchText !== '') {
          if (
            !resolved.name.toLowerCase().includes(searchText) &&
            !resolved.description.toLowerCase().includes(searchText)
          ) {
            continue;
          }
        }

        const isOwner = userOwned.includes(resolved._id.toString());

        const isAnnotatable = isOwner
          ? // owner can always annotate
            true
          : // only logged in and only if included in whitelist
          resolved.whitelist.enabled && userData
          ? JSON.stringify(resolved.whitelist).includes(userData._id.toString())
          : false;
        if (filters.annotatable && !isAnnotatable) continue;

        const isAnnotated = resolved.annotationList.length > 0;
        if (filters.annotated && !isAnnotated) continue;

        let isRestricted = false;

        // TODO: decide what to do with password protected compilations
        if (resolved.password && resolved.password !== '') {
          resolved.annotationList = [];
          resolved.entities = (resolved.entities as IEntity[]).map(_e => {
            _e.relatedDigitalEntity = { _id: 'hidden' };
            _e.processed = { low: '', medium: '', high: '', raw: '' };
            _e.annotationList = [];
            return _e;
          });
          resolved.password = true;
          isRestricted = true;
        }
        if (filters.restricted && !isRestricted) continue;

        compilations.push(resolved);
      }

      items.push(...compilations);
    }

    response.send(items.sort((a, b) => a.name.localeCompare(b.name)));
  },
};

Mongo.init().catch(e => Logger.err(e));

export { Mongo, getCurrentUserBySession, areObjectIdsEqual };
