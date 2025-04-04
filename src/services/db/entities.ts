// prettier-ignore
import {  ICompilation, IEntity, IUserData, isAddress, isAnnotation, isCompilation, isContact, isDigitalEntity, isEntity, isGroup, isInstitution, isPerson, isPhysicalEntity, isTag, Collection } from '../../common';
// prettier-ignore
import { IEntityHeadsUp, PushableEntry, isValidCollection, CollectionName } from './definitions';
import { ObjectId } from 'mongodb';
import { Request, Response } from 'express';
import { RepoCache } from '../cache';
import { Logger } from '../logger';
import { Resolve } from './resolving-strategies';
import { Save } from './saving-strategies';
import { query, updatePreviewImage } from './functions';
import {
  exploreEntities,
  exploreCompilations,
  IExploreRequest,
  SortOrder,
} from './explore-strategies';

import Users from './users';
import { Repo } from './controllers';

interface IEntityRequestParams {
  identifier: string;
  collection: string;
  password?: string;
}

/**
 * Takes an object and tries to save it to a collection. Depending on the type of the object also
 * transforms the object and recursively saves inner objects (see saving strategies).
 * Objects get validated via a type guard and the associated collection name.
 * If the object type and the collection name do not match, returns undefined.
 * @type {[type]}
 */
const saveEntity = (
  entity: PushableEntry,
  options: { coll: CollectionName; user: IUserData; doesEntityExist: boolean },
): Promise<PushableEntry> | undefined => {
  const { coll, user, doesEntityExist } = options;
  switch (coll) {
    case Collection.address:
      return isAddress(entity) ? Save.address(entity, user) : undefined;
    case Collection.annotation:
      return isAnnotation(entity) ? Save.annotation(entity, user, doesEntityExist!) : undefined;
    case Collection.compilation:
      return isCompilation(entity) ? Save.compilation(entity, user) : undefined;
    case Collection.contact:
      return isContact(entity) ? Save.contact(entity, user) : undefined;
    case Collection.digitalentity:
      return isDigitalEntity(entity) ? Save.digitalentity(entity, user) : undefined;
    case Collection.entity:
      return isEntity(entity) ? Save.entity(entity, user) : undefined;
    case Collection.group:
      return isGroup(entity) ? Save.group(entity) : undefined;
    case Collection.institution:
      return isInstitution(entity) ? Save.institution(entity, user) : undefined;
    case Collection.person:
      return isPerson(entity) ? Save.person(entity, user) : undefined;
    case Collection.physicalentity:
      return isPhysicalEntity(entity) ? Save.metadataentity(entity, user) : undefined;
    case Collection.tag:
      return isTag(entity) ? Save.tag(entity, user) : undefined;
    default:
      return undefined;
  }
};

// TODO: Should all collections be pushable?
const addEntityToCollection = async (
  req: Request<any, any, PushableEntry>,
  res: Response<any, IEntityHeadsUp>,
) => {
  RepoCache.flush();

  const { user, doesEntityExist, isValidObjectId, collectionName: coll } = res.locals.headsUp;
  if (!isValidCollection(coll)) return res.status(400).send('Invalid collection');

  let entity = req.body;
  const _id = isValidObjectId ? new ObjectId(entity._id) : new ObjectId();
  // @ts-ignore-next-line
  entity._id = _id;

  const savingPromise = saveEntity(entity, { coll, user, doesEntityExist });
  if (!savingPromise)
    return res.status(400).send('Sent entity does not belong in given collection');

  // Just in case this did not happen in the saving strategy
  Users.makeOwnerOf(req, _id, coll);

  // Run saving promise
  const resultEntity = await savingPromise.catch(err => {
    Logger.err('Failed saving entity to database', err);
    return undefined;
  });
  if (!resultEntity) return res.status(500).send('Failed saving entity to database');

  // This might double save, but that does not really matter
  const updateResult = await Repo.get(coll)?.updateOne(
    { _id },
    { $set: resultEntity },
    { upsert: true },
  );
  if (!updateResult) {
    Logger.err(`Failed updating ${coll} ${_id}`);
    return res.status(500).send(`Failed updating ${coll} ${_id}`);
  }

  const resultId = updateResult.upsertedId ?? _id;
  Logger.info(`Success! Updated ${coll} ${_id}`);
  return res.status(200).send(await resolve<any>(resultId, coll));
};

const updateEntitySettings = async (req: Request<IEntityRequestParams>, res: Response) => {
  const preview = req.body.preview;
  const identifier = ObjectId.isValid(req.params.identifier)
    ? new ObjectId(req.params.identifier)
    : req.params.identifier;

  // Save preview to file, if not yet done
  const finalImagePath = await updatePreviewImage(preview, 'entity', identifier);

  // Overwrite old settings
  const settings = { ...req.body, preview: finalImagePath };
  // @ts-ignore-next-line
  const result = await Repo.entity.updateOne({ _id: identifier }, { $set: { settings } });

  if (!result) return res.status(500).send('Failed updating settings');

  return res.status(200).send(settings);
};

const resolve = async <T>(obj: any, coll: CollectionName, depth?: number) => {
  if (!isValidCollection(coll)) return undefined;
  if (!obj) return undefined;

  const parsedId = (obj._id ? obj._id : obj).toString();
  if (!ObjectId.isValid(parsedId)) return undefined;
  const _id = new ObjectId(parsedId);

  // Get shallow result. Attempt to get from cache
  const result =
    (await RepoCache.get<T>(parsedId)) ?? (await Repo.get<T>(coll)?.findOne(query(_id)));
  if (!result) return undefined;

  // Cache shallow result
  await RepoCache.set(parsedId, result);

  // Either return or resolve deeper
  if (depth === 0) return result;
  return Resolve.get<T>(coll, result) ?? result;
};

const getEntityFromCollection = async (req: Request<IEntityRequestParams>, res: Response) => {
  const coll = req.params.collection.toLowerCase();
  if (!isValidCollection(coll)) return res.status(400).send('Invalid collection');

  const _id = ObjectId.isValid(req.params.identifier)
    ? new ObjectId(req.params.identifier)
    : req.params.identifier;
  const password = req.params.password ? req.params.password : '';
  const entity = await resolve<any>(_id, coll);
  if (!entity) return res.status(404).send(`No ${coll} found with given identifier`);

  if (isCompilation(entity)) {
    const compilation = entity;
    const _pw = compilation.password;
    const isPasswordProtected = _pw && _pw !== '';
    const isUserOwner = await Users.isOwner(req, _id);
    const isPasswordCorrect = _pw && _pw === password;

    if (!isPasswordProtected || isUserOwner || isPasswordCorrect)
      return res.status(200).send(compilation);

    return res.status(200).end();
  }
  return res.status(200).send(entity);
};

const getAllEntitiesFromCollection = async (req: Request<IEntityRequestParams>, res: Response) => {
  const coll = req.params.collection.toLowerCase();
  if (!isValidCollection(coll)) return res.status(400).send('Invalid collection');

  const allowed = ['person', 'institution', 'tag'];
  if (!allowed.includes(coll)) return res.status(200).send([]);

  const docs = (await Repo.get(coll)?.findAll()) ?? [];
  const resolved = await Promise.all(docs.map(doc => resolve<unknown>(doc, coll)));
  return res.status(200).send(resolved.filter(_ => _));
};

const removeEntityFromCollection = async (req: Request<IEntityRequestParams>, res: Response) => {
  const coll = req.params.collection.toLowerCase();

  const _id = ObjectId.isValid(req.params.identifier)
    ? new ObjectId(req.params.identifier).toString()
    : req.params.identifier;

  const user = await Users.getBySession(req);
  if (!user) return res.status(404).send('User not found');

  if (req.body?.username !== user?.username) {
    Logger.err('Entity removal failed due to username & session not matching');
    return res.status(403).send('Input username does not match username with current sessionID');
  }

  // Flatten account.data so its an array of ObjectId.toString()
  const UserRelatedEntities = Array.prototype
    .concat(...Object.values(user.data))
    .map(id => id.toString());

  if (!UserRelatedEntities.find(obj => obj === _id)) {
    const message = 'Entity removal failed because Entity does not belong to user';
    Logger.err(message);
    return res.status(401).send(message);
  }

  const deleteResult = await Repo.get(coll)?.deleteOne(query(_id));
  if (!deleteResult) {
    const message = `Failed deleting ${coll} ${req.params.identifier}`;
    Logger.warn(message);
    return res.status(500).send(message);
  }

  // Delete from User
  if (!(await Users.undoOwnerOf(user, _id, coll))) {
    const message = `Failed removing owner of ${coll} ${req.params.identifier}`;
    Logger.warn(message);
    return res.status(500).send(message);
  }

  const message = `Deleted ${coll} ${req.params.identifier}`;
  Logger.info(message);
  res.status(200).send({ message });

  return RepoCache.flush();
};

const searchByEntityFilter = async (req: Request<IEntityRequestParams>, res: Response) => {
  const coll = req.params.collection.toLowerCase();
  if (!isValidCollection(coll)) return res.status(400).send('Invalid collection');

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

  const docs = (await Repo.get(coll)?.findAll()) ?? [];
  const resolved = await Promise.all(docs.map(doc => resolve<any>(doc, coll)));
  const filtered = resolved.filter(obj => {
    for (const prop in filter) {
      if (!doesEntityPropertyMatch(obj, prop)) return false;
    }
    return true;
  });

  return res.status(200).send(filtered);
};

const searchByTextFilter = async (req: Request<IEntityRequestParams>, res: Response) => {
  const coll = req.params.collection.toLowerCase();
  if (!isValidCollection(coll)) return res.status(400).send('Invalid collection');

  const filter = req.body.filter ? req.body.filter.map((_: any) => _.toLowerCase()) : [''];
  const offset = req.body.offset ? parseInt(req.body.offset, 10) : 0;
  const length = 20;

  if (typeof offset !== 'number') return res.status(400).send('Offset is not a number');

  if (offset < 0) return res.status(400).send('Offset is smaller than 0');

  const docs = ((await Repo.get(coll)?.findAll()) ?? []).slice(offset, offset + length);
  const resolved = await Promise.all(docs.map(doc => resolve<any>(doc, coll)));

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

  return res.status(200).send(filterResults(resolved));
};

// TODO: improve performance by splitting into multiple indexes?
const explore = async (req: Request<any, any, IExploreRequest>, res: Response) => {
  const { searchEntity } = req.body;
  const userData = await Users.getBySession(req);

  const fixedBody = {
    ...req.body,
    sortBy: req.body.sortBy ?? SortOrder.popularity,
    limit: 30,
    userData,
    reversed: req.body.reversed ?? false,
  };

  // Check if req is cached
  const reqHash = RepoCache.hash({ sessionID: req.sessionID ?? 'guest', ...req.body });

  RepoCache.get<IEntity[] | ICompilation[]>(reqHash)
    .then(cachedItems => {
      if (cachedItems) return cachedItems;
      // @ts-ignore-next-line
      if (searchEntity) return exploreEntities(fixedBody);
      // @ts-ignore-next-line
      return exploreCompilations(fixedBody);
    })
    .then(finalItems => {
      res.status(200).send(finalItems);
      RepoCache.set(reqHash, finalItems, 3600);
    });
};

/**
 * Resolves all entries in a collection. Used for error checking
 */
const test = async (req: Request<IEntityRequestParams>, res: Response) => {
  const coll = req.params.collection.toLowerCase();
  if (!isValidCollection(coll)) return res.status(400).send('Invalid collection');

  const docs = (await Repo.get(coll)?.findAll()) ?? [];
  const resolved = await Promise.all(docs.map(doc => resolve<any>(doc, coll)));
  const filtered = resolved.filter(_ => _);

  // prettier-ignore
  Logger.info(`Found ${docs.length} in ${coll}. Resolved ${resolved.length}. Remaining after filtering ${filtered.length}`);

  return res.json({ found: docs.length, resolved: resolved.length, final: filtered.length });
};

/**
 * Resolves all entries in all collections. Used for error checking
 */
const testAll = async (_: Request, res: Response) => {
  const collections = Object.values(Collection);
  const totals = { found: 0, resolved: 0, final: 0 };

  for (const coll of collections) {
    const docs = (await Repo.get(coll)?.findAll()) ?? [];
    const resolved = await Promise.all(docs.map(doc => resolve<any>(doc, coll)));
    const filtered = resolved.filter(_ => _);

    // prettier-ignore
    Logger.info(`Found ${docs.length} in ${coll}. Resolved ${resolved.length}. Remaining after filtering ${filtered.length}`);

    totals.found += docs.length;
    totals.resolved += resolved.length;
    totals.final += filtered.length;
  }

  return res.json(totals);
};

export const Entities = {
  addEntityToCollection,
  updateEntitySettings,
  resolve,
  getEntityFromCollection,
  getAllEntitiesFromCollection,
  removeEntityFromCollection,
  searchByEntityFilter,
  searchByTextFilter,
  explore,
  test,
  testAll,
};

export default Entities;
