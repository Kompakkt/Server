// prettier-ignore
import {  ICompilation, IEntity, IDigitalEntity, IUserData, isAddress, isAnnotation, isCompilation, isContact, isDigitalEntity, isEntity, isGroup, isInstitution, isPerson, isPhysicalEntity, isTag } from '../../common/interfaces';
// prettier-ignore
import { IEntityHeadsUp, PushableEntry, isValidCollection, ECollection, CollectionName } from './definitions';
import { ObjectId } from 'mongodb';
import { Request, Response } from 'express';
import { RepoCache } from '../cache';
import { Logger } from '../logger';
import { Resolve } from './resolving-strategies';
import { Save } from './saving-strategies';
import { query, updatePreviewImage } from './functions';

import Users from './users';
import { Repo } from './controllers';

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
    case ECollection.address:
      return isAddress(entity) ? Save.address(entity, user) : undefined;
    case ECollection.annotation:
      return isAnnotation(entity) ? Save.annotation(entity, user, doesEntityExist!) : undefined;
    case ECollection.compilation:
      return isCompilation(entity) ? Save.compilation(entity, user) : undefined;
    case ECollection.contact:
      return isContact(entity) ? Save.contact(entity, user) : undefined;
    case ECollection.digitalentity:
      return isDigitalEntity(entity) ? Save.digitalentity(entity, user) : undefined;
    case ECollection.entity:
      return isEntity(entity) ? Save.entity(entity, user) : undefined;
    case ECollection.group:
      return isGroup(entity) ? Save.group(entity, user) : undefined;
    case ECollection.institution:
      return isInstitution(entity) ? Save.institution(entity, user) : undefined;
    case ECollection.person:
      return isPerson(entity) ? Save.person(entity, user) : undefined;
    case ECollection.physicalentity:
      return isPhysicalEntity(entity) ? Save.metadataentity(entity, user) : undefined;
    case ECollection.tag:
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
  res.status(200).send(message);

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
const explore = async (req: Request<any, IExploreRequest>, res: Response) => {
  const { types, offset, searchEntity, filters, searchText } = req.body;
  const items = new Array<IEntity | ICompilation>();
  const limit = 30;
  const userData = await Users.getBySession(req);
  const userOwned = userData ? JSON.stringify(userData.data) : '';

  // Check if req is cached
  const reqHash = RepoCache.hash({ sessionID: req.sessionID ?? 'guest', ...req.body });
  const temp = await RepoCache.get<IEntity[] | ICompilation[]>(reqHash);

  if (temp && temp?.length > 0) {
    items.push(...temp);
  } else if (searchEntity) {
    const cursor = Repo.entity
      .findCursor({
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
      (await cursor.hasNext()) && entities.length < limit && types.length > 0;

    while (await canContinue()) {
      const _entity = await cursor.next();
      if (!_entity || !_entity._id) continue;
      const resolved = await resolve<IEntity>(_entity, 'entity');
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
        const isWhitelisted = JSON.stringify(resolved.whitelist).includes(userData._id.toString());
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

      const { description, licence } = resolved.relatedDigitalEntity as IDigitalEntity;
      entities.push({
        ...resolved,
        relatedDigitalEntity: {
          description,
          licence,
        } as IDigitalEntity,
      } as IEntity);
    }

    items.push(...entities);
  } else {
    const cursor = Repo.compilation
      .findCursor({})
      .sort({
        name: 1,
      })
      .skip(offset);
    const compilations: ICompilation[] = [];

    const canContinue = async () =>
      (await cursor.hasNext()) && !cursor.closed && compilations.length < limit && types.length > 0;

    while (await canContinue()) {
      const _comp = await cursor.next();
      if (!_comp) continue;
      const resolved = await resolve<ICompilation>(_comp, 'compilation');

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
  RepoCache.set(reqHash, items, 3600);
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
  const collections = Object.values(ECollection);
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
