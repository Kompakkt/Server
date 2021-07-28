/* tslint:disable:max-line-length */
import { NextFunction, Request, Response } from 'express';
import { ensureDir, writeFile } from 'fs-extra';
import * as imagemin from 'imagemin';
import * as pngquant from 'imagemin-pngquant';
import {
  Collection,
  Db,
  MatchKeysAndValues,
  MongoClient,
  ObjectId,
  FilterQuery,
  UpdateQuery,
  UpdateOneOptions,
} from 'mongodb';

import { RootDirectory } from '../environment';
import {
  ICompilation,
  IEntity,
  IUserData,
  EUserRank,
  IMetaDataDigitalEntity,
  isAnnotation,
  isCompilation,
  isDigitalEntity,
  isEntity,
  isPerson,
  isInstitution,
} from '../common/interfaces';

import { Configuration } from './configuration';
import { RepoCache, UserCache } from './cache';
import { Logger } from './logger';
import {
  resolveCompilation,
  resolveDigitalEntity,
  resolveEntity,
  resolvePerson,
  resolveInstitution,
} from './resolving-strategies';
import {
  saveAnnotation,
  saveCompilation,
  saveDigitalEntity,
  saveEntity,
  savePerson,
  saveInstitution,
} from './saving-strategies';
/* tslint:enable:max-line-length */

const isUser = (obj: any): obj is IUserData => {
  return obj && !!obj?.username && !!obj?.mail;
};

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

// Wrapper to combine MongoDB updateOne & Cache
const updateOne = async (
  coll: Collection<any>,
  query: FilterQuery<any>,
  update: UpdateQuery<any>,
  options?: UpdateOneOptions,
) => {
  // TODO: Only invalidate keys that need invalidation
  await Promise.all([RepoCache.flush(), UserCache.flush()]);
  // Mongo does not allow mutation of the _id property.
  // Deletes _id from all $set queries
  if (update.$set) {
    const setobj = update.$set as any;
    delete setobj['_id'];
    update.$set = setobj as MatchKeysAndValues<any>;
  }
  return coll.updateOne(query, update, options);
};

const areObjectIdsEqual = (firstId: string | ObjectId, secondId: string | ObjectId) =>
  new ObjectId(firstId).toString() === new ObjectId(secondId).toString();

// TODO: (Optional) Convert to progressive JPEG?
const updatePreviewImage = async (
  base64OrUrl: string,
  subfolder: string,
  identifier: string | ObjectId,
) => {
  const convertBase64ToBuffer = (input: string) => {
    const replaced = input.replace(/^data:image\/(png|gif|jpeg);base64,/, '');
    return Buffer.from(replaced, 'base64');
  };

  const minifyBuffer = (buffer: Buffer) =>
    imagemin.buffer(buffer, {
      plugins: [
        pngquant.default({
          speed: 1,
          strip: true,
          dithering: 1,
        }),
      ],
    });

  const writeBufferToFile = async (buffer: Buffer) => {
    const subfolderPath = `${RootDirectory}/${UploadConf.UploadDirectory}/previews/${subfolder}/`;
    const filePath = `${subfolderPath}${identifier}.png`;
    return ensureDir(subfolderPath)
      .then(() => writeFile(filePath, buffer))
      .then(() => `previews/${subfolder}/${identifier}.png`);
  };

  const getPreviewImagePath = async (input: string) => {
    // If the image is not a base64 image we assume it has already been converted and saved to disk
    if (!input.includes('data:image')) return `previews/${input.split('previews/')[1]}`;

    // Otherwise we save it to a new file
    const converted = convertBase64ToBuffer(input);
    const minified = await minifyBuffer(converted);

    return await writeBufferToFile(minified);
  };

  const finalImagePath = await getPreviewImagePath(base64OrUrl).catch(() => 'previews/noimage.png');

  const https = Configuration.Express.enableHTTPS ? 'https' : 'http';
  const pubip = Configuration.Express.PublicIP;
  const port = Configuration.Express.Port;

  return `${https}://${pubip}:${port}/${finalImagePath}`;
};

const MongoURL = MongoConf.ClientURL ?? `mongodb://${MongoConf.Hostname}:${MongoConf.Port}/`;
const Client = new MongoClient(MongoURL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// MongoDB Helper methods
const getAccountsRepository = (): Db => Client.db(MongoConf.AccountsDB);
const getEntitiesRepository = (): Db => Client.db(MongoConf.RepositoryDB);
const users = (): Collection<IUserData> => getAccountsRepository().collection('users');
const getCollection = <T extends unknown>(collectionName: string) =>
  getEntitiesRepository().collection<T>(collectionName);
const getCurrentUserBySession = async (req: Request) => {
  const _id = req.session?.passport?.user;
  const sessionID = req.sessionID;
  if (!sessionID || !_id) return null;
  return users().findOne({
    sessionID,
    $or: [{ _id }, { _id: new ObjectId(_id) }, { _id: _id.toString() }],
  });
};
const getUserByUsername = async (username: string) => users().findOne({ username });
const getAllItemsOfCollection = async <T extends unknown>(collectionName: string) =>
  getCollection<T>(collectionName).find({}).toArray();

interface IMongo {
  init(): Promise<MongoClient>;
  isMongoDBConnected(_: Request, res: Response, next: NextFunction): void;
  getAccountsRepository(): Db;
  getEntitiesRepository(): Db;
  updatePreviewImage(
    base64input: string,
    subfolder: string,
    identifier: string | ObjectId,
  ): Promise<string>;
  fixObjectId(req: Request, _: Response, next: NextFunction): void;
  getUnusedObjectId(_: Request, res: Response): void;
  invalidateSession(req: Request, res: Response): void;
  updateSessionId(req: Request, res: Response, next: NextFunction): Promise<any>;
  addToAccounts(req: Request, res: Response): any;
  insertCurrentUserData(
    req: Request | IUserData,
    identifier: string | ObjectId,
    collection: string,
  ): Promise<any>;
  resolveUserData(_userData: IUserData): Promise<IUserData>;
  getCurrentUserData(req: Request, res: Response): Promise<any>;
  validateLoginSession(req: Request, res: Response, next: NextFunction): Promise<any>;
  submit(req: Request, res: Response): Promise<any>;
  isAllowedToEdit(req: Request, res: Response, next: NextFunction): Promise<any>;
  addEntityToCollection(req: Request, res: Response): Promise<any>;
  updateEntitySettings(req: Request, res: Response): Promise<any>;
  isUserOwnerOfEntity(req: Request | IUserData, identifier: string | ObjectId): Promise<any>;
  isUserAdmin(req: Request): Promise<boolean>;
  query(_id: string | ObjectId): any;
  resolve<T>(obj: any, collection_name: string, depth?: number): Promise<T | null | undefined>;
  getEntityFromCollection(req: Request, res: Response): Promise<any>;
  getAllEntitiesFromCollection(req: Request, res: Response): Promise<any>;
  removeEntityFromCollection(req: Request, res: Response): any;
  searchByEntityFilter(req: Request, res: Response): Promise<any>;
  searchByTextFilter(req: Request, res: Response): Promise<any>;
  explore(req: Request, res: Response): Promise<any>;
  test(req: Request, res: Response): Promise<any>;
}

const Mongo: IMongo = {
  init: async () => {
    return new Promise<MongoClient>((resolve, reject) => {
      if (Client.isConnected()) return resolve(Client);
      Client.connect(error => {
        if (!error) {
          resolve(Client);
          Logger.info('Connected to MongoDB');
        } else {
          reject();
          Logger.err(`Couldn't connect to MongoDB.
            Make sure it is running and check your configuration`);
          process.exit(1);
        }
      });
    });
  },
  isMongoDBConnected: (_, res, next) => {
    if (!Client.isConnected()) {
      Logger.warn('Incoming req while not connected to MongoDB');
      return res.status(500).send('Cannot connect to Database. Contact sysadmin');
    }
    return next();
  },
  getAccountsRepository,
  getEntitiesRepository,
  updatePreviewImage,
  /**
   * Fix cases where an ObjectId is sent but it is not detected as one
   * used as Middleware
   */
  fixObjectId: (req, _, next) => {
    if (req) {
      if (req.body && req.body['_id'] && ObjectId.isValid(req.body['_id'])) {
        req.body['_id'] = new ObjectId(req.body['_id']);
      }
    }
    next();
  },
  getUnusedObjectId: (_, res) => {
    res.status(200).send(new ObjectId());
  },
  invalidateSession: (req, res) => {
    const sessionID = req.sessionID;
    users().updateMany({ sessionID }, { $set: { sessionID: '' } }, () => {
      Logger.log('Logged out');
      res.status(200).end();
    });
  },
  updateSessionId: async (req, res, next) => {
    const username = req.body.username.toLowerCase();
    const userData = await getUserByUsername(username);

    if (!userData) return res.status(404).send('Failed finding user with username');

    const sessionID = req.sessionID;

    const updateResult = await updateOne(
      users(),
      { username },
      {
        $set: {
          ...userData,
          username,
          sessionID,
        },
      },
    );

    if (updateResult.result.ok !== 1)
      return res.status(500).send('Failed updating user in database');

    return next();
  },
  addToAccounts: async (req, res) => {
    const user: IUserData = req.user as IUserData;
    const username = req.body.username.toLowerCase();
    const sessionID = req.sessionID ? req.sessionID : null;
    const userData = await getUserByUsername(username);

    if (!sessionID) return res.status(400).send('No sessionID sent with req');

    const updatedUser: IUserData = {
      ...user,
      username,
      sessionID,
      data: userData ? userData.data : {},
      role: userData ? userData.role : EUserRank.user,
    };
    delete (updatedUser as any)['_id']; // To prevent Mongo write error

    return updateOne(users(), { username }, { $set: updatedUser }, { upsert: true })
      .then(async () => {
        Logger.log(`User ${updatedUser.username} logged in`);
        res.status(200).send(await Mongo.resolveUserData(updatedUser));
      })
      .catch(error => {
        Logger.err(error);
        res.status(500).send('Failed updating user entry in database');
      });
  },
  insertCurrentUserData: async (req, identifier: string | ObjectId, collection: string) => {
    const user = isUser(req)
      ? await getUserByUsername(req.username)
      : await getCurrentUserBySession(req as Request);

    if (!ObjectId.isValid(identifier) || !user) return false;

    user.data[collection] = user.data[collection] ? user.data[collection] : [];

    const doesExist = user.data[collection]
      .filter(obj => obj)
      .find((obj: any) => obj.toString() === identifier.toString());

    if (doesExist) return true;

    user.data[collection].push(new ObjectId(identifier));
    const updateResult = await updateOne(users(), Mongo.query(user._id), {
      $set: { data: user.data },
    });

    if (updateResult.result.ok !== 1) return false;
    return true;
  },
  resolveUserData: async _userData => {
    const userData = { ..._userData } as IUserData;

    const hash = UserCache.hash(userData.username);
    const temp = await UserCache.get<IUserData>(hash);

    if (temp) {
      return temp;
    }

    if (userData.data) {
      for (const property in userData.data) {
        userData.data[property] = await Promise.all(
          userData.data[property].map(async obj => Mongo.resolve(obj, property)),
        );
        // Filter possible null's
        userData.data[property] = userData.data[property].filter(
          obj => obj && Object.keys(obj).length > 0,
        );
      }
    }

    UserCache.set(hash, userData);

    return userData;
  },
  getCurrentUserData: async (req, res) => {
    const user = await getCurrentUserBySession(req);
    return user
      ? res.status(200).send(await Mongo.resolveUserData(user))
      : res.status(404).send('User not found by sessionID. Try relogging');
  },
  validateLoginSession: async (req, _, next) => {
    const user = await getCurrentUserBySession(req);
    return next(user ? null : 'User not found by session');
  },
  /**
   * DEPRECATED: Redirects to correct function though!
   * When the user submits the metadataform this function
   * adds the missing data to defined collections
   */
  submit: async (req, res) => {
    Logger.info('Handling submit req');
    req.params.collection = 'digitalentity';
    await Mongo.addEntityToCollection(req, res);
  },
  isAllowedToEdit: async (req, res, next) => {
    const userData = await getCurrentUserBySession(req);
    if (!userData) return res.status(404).send('User not found by session');

    const collectionName = req.params.collection.toLowerCase();
    const entity = req.body;

    const isValidObjectId = ObjectId.isValid(entity['_id']);
    const doesEntityExist = !!(await Mongo.resolve(entity, collectionName, 0));

    /**
     * If the entity already exists we need to check for owner status
     * We skip this for annotations, since annotation ranking can be changed by owner
     * We check this in the saving strategy instead
     * We also skip this for persons and institutions since their nested content
     * (addresses, contact_references, etc.) can also be updated
     */
    const isEditableType = (_e: any) => isAnnotation(_e) || isPerson(_e) || isInstitution(_e);

    if (isValidObjectId && doesEntityExist && !isEditableType(entity))
      if (!(await Mongo.isUserOwnerOfEntity(req, entity['_id'])))
        return res.status(401).send('User is not owner');

    (req as any).data = {
      userData,
      doesEntityExist,
      isValidObjectId,
      collectionName,
    };

    return next();
  },
  addEntityToCollection: async (req, res) => {
    RepoCache.flush();

    const { userData, doesEntityExist, isValidObjectId, collectionName } = (req as any).data as {
      userData: IUserData;
      doesEntityExist: boolean;
      isValidObjectId: boolean;
      collectionName: string;
    };

    const collection = getCollection(collectionName);
    let entity = req.body;
    const _id = isValidObjectId ? new ObjectId(entity._id) : new ObjectId();
    entity._id = _id;

    let savingPromise: Promise<any> | undefined;
    switch (true) {
      case isCompilation(entity):
        savingPromise = saveCompilation(entity, userData);
        break;
      case isEntity(entity):
        savingPromise = saveEntity(entity, userData);
        break;
      case isAnnotation(entity):
        savingPromise = saveAnnotation(entity, userData, doesEntityExist);
        break;
      case isPerson(entity):
        savingPromise = savePerson(entity, userData);
        break;
      case isInstitution(entity):
        savingPromise = saveInstitution(entity, userData);
        break;
      case isDigitalEntity(entity):
        savingPromise = saveDigitalEntity(entity, userData);
        break;
      default:
        await Mongo.insertCurrentUserData(req, _id, collectionName);
        break;
    }
    await savingPromise
      ?.then(async res => {
        entity = res;
        if (isDigitalEntity(entity))
          await Mongo.insertCurrentUserData(req, entity._id, 'digitalentity');
      })
      .catch(err => Logger.err(err) && res.status(500).send(err));

    // We already got rejected. Don't update entity in DB
    if (res.headersSent) return undefined;

    const updateResult = await updateOne(collection, { _id }, { $set: entity }, { upsert: true });

    if (updateResult.result.ok !== 1) {
      Logger.err(`Failed updating ${collectionName} ${_id}`);
      return res.status(500).send(`Failed updating ${collectionName} ${_id}`);
    }

    const resultId = updateResult.upsertedId ? updateResult.upsertedId._id : _id;
    Logger.info(`Success! Updated ${collectionName} ${_id}`);
    return res.status(200).send(await Mongo.resolve<any>(resultId, collectionName));
  },
  updateEntitySettings: async (req, res) => {
    const preview = req.body.preview;
    const identifier = ObjectId.isValid(req.params.identifier)
      ? new ObjectId(req.params.identifier)
      : req.params.identifier;
    const collection = getCollection<IEntity>('entity');

    // Save preview to file, if not yet done
    const finalImagePath = await updatePreviewImage(preview, 'entity', identifier);

    // Overwrite old settings
    const settings = { ...req.body, preview: finalImagePath };
    const result = await updateOne(collection, { _id: identifier }, { $set: { settings } });

    if (result.result.ok !== 1) return res.status(500).send('Failed updating settings');

    return res.status(200).send(settings);
  },
  isUserOwnerOfEntity: async (req, identifier: string | ObjectId) => {
    const _id = ObjectId.isValid(identifier) ? new ObjectId(identifier) : identifier;
    const user = isUser(req)
      ? await getUserByUsername(req.username)
      : await getCurrentUserBySession(req);
    if (!user) return false;
    const resolvedUser = (await Mongo.resolveUserData(user)) ?? {};
    return JSON.stringify(resolvedUser).indexOf(_id.toString()) !== -1;
  },
  isUserAdmin: async req => {
    const userData = await getCurrentUserBySession(req);
    return userData ? userData.role === EUserRank.admin : false;
  },
  query: (_id: string | ObjectId): FilterQuery<any> => {
    return {
      $or: [{ _id }, { _id: new ObjectId(_id) }, { _id: _id.toString() }],
    };
  },
  resolve: async <T extends unknown>(obj: any, collection_name: string, depth?: number) => {
    if (!obj) return undefined;
    const parsedId = (obj['_id'] ? obj['_id'] : obj).toString();
    if (!ObjectId.isValid(parsedId)) return undefined;
    const _id = new ObjectId(parsedId);
    const resolve_collection = getCollection<T>(collection_name);

    const temp = await RepoCache.get<T>(parsedId);
    if (temp) {
      // Make sure returned object is valid and not {}
      if ((temp as any)._id) {
        return temp as T;
      }
      // Flush invalid object from cache
      RepoCache.del(parsedId).then(numDelKeys => {
        if (numDelKeys > 0) Logger.info(`Deleted ${parsedId} from ${collection_name} cache`);
      });
    }
    return resolve_collection
      .findOne(Mongo.query(_id))
      .then(async resolve_result => {
        if (depth && depth === 0) return resolve_result;

        if (isDigitalEntity(resolve_result)) return resolveDigitalEntity(resolve_result);

        if (isEntity(resolve_result)) return resolveEntity(resolve_result);

        if (isCompilation(resolve_result)) return resolveCompilation(resolve_result);

        if (isPerson(resolve_result)) return resolvePerson(resolve_result);

        if (isInstitution(resolve_result)) return resolveInstitution(resolve_result);

        return resolve_result;
      })
      .then(async result => {
        if (result) await RepoCache.set(parsedId, result);
        return result as T | null;
      })
      .catch(err => {
        Logger.warn(`Encountered error trying to resolve ${parsedId} in ${collection_name}`);
        Logger.err(err);
        return undefined;
      });
  },
  getEntityFromCollection: async (req, res) => {
    const RequestCollection = req.params.collection.toLowerCase();

    const _id = ObjectId.isValid(req.params.identifier)
      ? new ObjectId(req.params.identifier)
      : req.params.identifier;
    const password = req.params.password ? req.params.password : '';
    const entity = await Mongo.resolve<any>(_id, RequestCollection);
    if (!entity) return res.status(404).send(`No ${RequestCollection} found with given identifier`);

    if (isCompilation(entity)) {
      const compilation = entity;
      const _pw = compilation.password;
      const isPasswordProtected = _pw && _pw !== '';
      const isUserOwner = await Mongo.isUserOwnerOfEntity(req, _id);
      const isPasswordCorrect = _pw && _pw === password;

      if (!isPasswordProtected || isUserOwner || isPasswordCorrect)
        return res.status(200).send(compilation);

      return res.status(200).end();
    }
    return res.status(200).send(entity);
  },
  getAllEntitiesFromCollection: async (req, res) => {
    const RequestCollection = req.params.collection.toLowerCase();
    const allowed = ['person', 'institution', 'tag'];
    if (!allowed.includes(RequestCollection)) return res.status(200).send([]);

    let results = await getAllItemsOfCollection(RequestCollection);

    for (let i = 0; i < results.length; i++) {
      results[i] = await Mongo.resolve(results[i], RequestCollection);
    }
    results = results.filter(_ => _);

    return res.status(200).send(results);
  },
  removeEntityFromCollection: async (req, res) => {
    const RequestCollection = req.params.collection.toLowerCase();

    const collection = getCollection(RequestCollection);
    const sessionID = req.sessionID;

    const identifier = ObjectId.isValid(req.params.identifier)
      ? new ObjectId(req.params.identifier)
      : req.params.identifier;

    const user = await getCurrentUserBySession(req);
    if (!user) return res.status(404).send('User not found');

    if (req.body?.username !== user?.username) {
      Logger.err('Entity removal failed due to username & session not matching');
      return res.status(403).send('Input username does not match username with current sessionID');
    }

    // Flatten account.data so its an array of ObjectId.toString()
    const UserRelatedEntities = Array.prototype
      .concat(...Object.values(user.data))
      .map(id => id.toString());

    if (!UserRelatedEntities.find(obj => obj === identifier.toString())) {
      const message = 'Entity removal failed because Entity does not belong to user';
      Logger.err(message);
      return res.status(401).send(message);
    }
    const delete_result = await collection.deleteOne({ _id: identifier });
    if (delete_result.result.ok === 1) {
      user.data[RequestCollection] = user.data[RequestCollection].filter(
        id => id !== identifier.toString(),
      );

      const update_result = await updateOne(users(), { sessionID }, { $set: { data: user.data } });

      if (update_result.result.ok === 1) {
        const message = `Deleted ${RequestCollection} ${req.params.identifier}`;
        Logger.info(message);
        res.status(200).send(message);
      } else {
        const message = `Failed deleting ${RequestCollection} ${req.params.identifier}`;
        Logger.warn(message);
        res.status(500).send(message);
      }
    } else {
      const message = `Failed deleting ${RequestCollection} ${req.params.identifier}`;
      Logger.warn(message);
      Logger.warn(delete_result);
      res.status(500).send(message);
    }
    return RepoCache.flush();
  },
  searchByEntityFilter: async (req, res) => {
    const RequestCollection = req.params.collection.toLowerCase();
    const body: any = req.body ? req.body : {};
    const filter: any = body.filter ? body.filter : {};

    const doesEntityPropertyMatch = (obj: any, propName: string, _filter = filter) => {
      if (obj[propName] === null || obj[propName] === undefined) return false;
      switch (typeof obj[propName]) {
        case 'string':
          if (obj[propName].indexOf(_filter[propName]) === -1) return false;
          break;
        case 'object':
          switch (typeof _filter[propName]) {
            case 'string':
              // Case: search for string inside of entity
              if (JSON.stringify(obj[propName]).indexOf(_filter[propName]) === -1) return false;
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
        if (!doesEntityPropertyMatch(obj, prop)) return false;
      }
      return true;
    });

    return res.status(200).send(allEntities);
  },
  searchByTextFilter: async (req, res) => {
    const RequestCollection = req.params.collection.toLowerCase();

    const filter = req.body.filter ? req.body.filter.map((_: any) => _.toLowerCase()) : [''];
    const offset = req.body.offset ? parseInt(req.body.offset, 10) : 0;
    const length = 20;

    if (typeof offset !== 'number') return res.status(400).send('Offset is not a number');

    if (offset < 0) return res.status(400).send('Offset is smaller than 0');

    let allEntities = (await getAllItemsOfCollection(RequestCollection)).slice(
      offset,
      offset + length,
    );
    allEntities = await Promise.all(allEntities.map(obj => Mongo.resolve(obj, RequestCollection)));

    const getNestedValues = (obj: any) => {
      let result: string[] = [];
      for (const key of Object.keys(obj)) {
        const prop = obj[key];
        if (!prop) continue;
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
      return result;
    };

    const filterResults = (objs: any[]) => {
      const result: any[] = [];
      for (const obj of objs) {
        const asText = getNestedValues(obj).join('').toLowerCase();
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

    return res.status(200).send(filterResults(allEntities));
  },
  explore: async (req, res) => {
    const { types, offset, searchEntity, filters, searchText } = req.body as IExploreRequest;
    const items = new Array<IEntity | ICompilation>();
    const limit = 30;
    const userData = await getCurrentUserBySession(req);
    const userOwned = userData ? JSON.stringify(userData.data) : '';

    // Check if req is cached
    const reqHash = RepoCache.hash(req.body);
    const temp = await RepoCache.get<IEntity[] | ICompilation[]>(reqHash);

    if (temp) {
      items.push(...temp);
    } else if (searchEntity) {
      const cursor = getCollection<IEntity>('entity')
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
        if (!_entity || !_entity._id) continue;
        const resolved = await Mongo.resolve<IEntity>(_entity, 'entity');
        if (!resolved) continue;

        const isOwner = userOwned.includes(resolved._id.toString());
        const metadata = JSON.stringify(resolved).toLowerCase();

        const isAnnotatable = isOwner; // only owner can set default annotations
        if (filters.annotatable && !isAnnotatable) continue;

        const isAnnotated = Object.keys(resolved.annotations).length > 0;
        if (filters.annotated && !isAnnotated) continue;

        let isRestricted = false;
        // Whitelist visibility filter
        if (resolved.whitelist.enabled) {
          if (!userData) continue;
          // TODO: manual checking instead of JSON.stringify
          const isWhitelisted = JSON.stringify(resolved.whitelist).includes(
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

        const { description, licence } = resolved.relatedDigitalEntity as IMetaDataDigitalEntity;
        entities.push({
          ...resolved,
          relatedDigitalEntity: {
            description,
            licence,
          } as IMetaDataDigitalEntity,
        } as IEntity);
      }

      items.push(...entities);
    } else {
      const cursor = getCollection<ICompilation>('compilation')
        .find({})
        .sort({
          name: 1,
        })
        .skip(offset);
      const compilations: ICompilation[] = [];

      const canContinue = async () =>
        (await cursor.hasNext()) &&
        !cursor.isClosed() &&
        compilations.length < limit &&
        types.length > 0;

      while (await canContinue()) {
        const _comp = await cursor.next();
        if (!_comp) continue;
        const resolved = await Mongo.resolve<ICompilation>(_comp, 'compilation');

        if (!resolved || !resolved._id) continue;
        if (Object.keys(resolved.entities).length === 0) continue;

        if (searchText !== '') {
          if (
            !resolved.name.toLowerCase().includes(searchText) &&
            !resolved.description.toLowerCase().includes(searchText)
          ) {
            continue;
          }
        }

        const isOwner = userOwned.includes(resolved._id.toString());

        const isPWProtected = resolved.password !== undefined && resolved.password !== '';

        // owner can always annotate
        // otherwise only logged in and only if included in whitelist
        const isWhitelisted =
          resolved.whitelist.enabled &&
          userData &&
          JSON.stringify(resolved.whitelist).includes(userData._id.toString());
        const isAnnotatable = isOwner ? true : isWhitelisted;
        if (filters.annotatable && !isAnnotatable) continue;

        if (isPWProtected && !isOwner && !isAnnotatable) continue;
        if (filters.restricted && isPWProtected) continue;

        const isAnnotated = Object.keys(resolved.annotations).length > 0;
        if (filters.annotated && !isAnnotated) continue;

        for (const id in resolved.entities) {
          const value = resolved.entities[id];
          if (!isEntity(value)) {
            delete resolved.entities[id];
            continue;
          }
          const { mediaType, name, settings } = value;
          resolved.entities[id] = { mediaType, name, settings } as IEntity;
        }
        for (const id in resolved.annotations) {
          const value = resolved.annotations[id];
          if (!isAnnotation(value)) {
            delete resolved.annotations[id];
            continue;
          }
          resolved.annotations[id] = { _id: value._id };
        }

        compilations.push({
          ...resolved,
          password: isPWProtected,
        });
      }

      items.push(...compilations);
    }

    res.status(200).send(items.sort((a, b) => a.name.localeCompare(b.name)));

    // Cache full req
    RepoCache.set(reqHash, items);
  },
  test: async (req, res) => {
    //console.log(req.ip, req.ips);
    const RequestCollection = req.params.collection.toLowerCase();
    let results = await getAllItemsOfCollection(RequestCollection);
    const maxRand = 5;
    const randIndex = Math.floor(Math.random() * (results.length - maxRand));
    results = results.slice(randIndex, randIndex + maxRand);
    results = await Promise.all(results.map(res => Mongo.resolve(res, RequestCollection)));
    results = results.filter(_ => _);
    return res.status(200).send(results.slice(0, 5));
    return res.status(200).send({});
  },
};

export { Mongo, getCurrentUserBySession, areObjectIdsEqual, updateOne };
