import { type Collection as DbCollection, ObjectId, type WithId } from 'mongodb';
import {
  Collection,
  type IAddress,
  type IAnnotation,
  type ICompilation,
  type IContact,
  type IDigitalEntity,
  type IDocument,
  type IEntity,
  type IGroup,
  type IInstitution,
  type IPerson,
  type IPhysicalEntity,
  type ITag,
  isAddress,
  isAnnotation,
  isCompilation,
  isContact,
  isDigitalEntity,
  isDocument,
  isEntity,
  isGroup,
  isInstitution,
  isPerson,
  isPhysicalEntity,
  isTag,
  isUnresolved,
} from 'src/common';
import { err, log } from 'src/logger';
import {
  addressCollection,
  annotationCollection,
  compilationCollection,
  contactCollection,
  digitalEntityCollection,
  entityCollection,
  groupCollection,
  institutionCollection,
  personCollection,
  physicalEntityCollection,
  tagCollection,
} from 'src/mongo';
import { entitiesCache } from 'src/redis';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import { HookManager } from './hooks';

type Resolvable<T> = ServerDocument<IDocument | T> | string | ObjectId;
type ResolveFn<T> = (obj: Resolvable<T>, depth: number) => Promise<ServerDocument<T> | undefined>;
type DangerousArray = (IDocument | ObjectId | string | undefined | null)[];

/**
 * Defines the maximum depth, if we ever need to pass the depth argument for full-depth resolving.
 * The maximum resolve depth possible is:
 * Compilation -> Entity -> DigitalEntity -> PhysicalEntity -> Person/Institution
 * With a depth of 10, we are safely above the actual maximum possible depth of 5.
 */
export const RESOLVE_FULL_DEPTH = 10;

// TODO: Can this method be removed?
const withStringId = <T extends { _id: string | ObjectId }>(entity: T): { _id: string } & T => ({
  ...entity,
  _id: entity._id.toString(),
});

const toDocument = <T extends IDocument>(obj: string | ObjectId | T): IDocument =>
  typeof obj === 'string' ? { _id: obj } : obj instanceof ObjectId ? { _id: obj.toString() } : obj;

const removeUnrelatedEntities = <T extends ServerDocument<IPerson> | ServerDocument<IInstitution>>(
  obj: T,
  entityId: string,
) => {
  const relatedRole = obj.roles[entityId];
  obj.roles = {};
  if (relatedRole) obj.roles[entityId] = relatedRole;
  if (isPerson(obj)) {
    const relatedInst = obj.institutions[entityId];
    obj.institutions = {};
    if (relatedInst) obj.institutions[entityId] = relatedInst;
    const relatedContact = obj.contact_references[entityId];
    obj.contact_references = {};
    if (relatedContact) obj.contact_references[entityId] = relatedContact;
  } else if (isInstitution(obj)) {
    const relatedAddress = obj.addresses[entityId];
    obj.addresses = {};
    if (relatedAddress) obj.addresses[entityId] = relatedAddress;
    const relatedNote = obj.notes[entityId];
    obj.notes = {};
    if (relatedNote) obj.notes[entityId] = relatedNote;
  }
  return obj;
};

const resolveAndCleanRelatedEntities = async <T extends IPerson | IInstitution>(
  items: DangerousArray,
  resolverFn: ResolveFn<T>,
  entityId: string,
  depth: number,
) => {
  return (
    await Promise.all(
      items.filter(Boolean).map(async item => {
        const resolved = await resolverFn(toDocument(item!), depth);
        return resolved && (isPerson(resolved) || isInstitution(resolved))
          ? withStringId(removeUnrelatedEntities(resolved, entityId))
          : null;
      }),
    )
  ).filter(Boolean) as unknown as T[];
};

export const resolveMetadataEntity = async <
  T extends ServerDocument<IDigitalEntity | IPhysicalEntity>,
>(
  entity: T,
  depth: number,
) => {
  if (!entity || !entity._id) return entity;
  const entityId = entity._id.toString();

  entity.persons = await resolveAndCleanRelatedEntities(
    entity.persons ?? [],
    resolvePerson,
    entityId,
    depth,
  );
  entity.institutions = await resolveAndCleanRelatedEntities(
    entity.institutions ?? [],
    resolveInstitution,
    entityId,
    depth,
  );

  return entity;
};

type ResolverFunction<T extends ServerDocument<T>> = (
  entity: ServerDocument<T>,
  depth: number,
) => Promise<T | undefined>;

/**
 * Resolves an array of items and removes any items that are falsy
 * @param items
 * @param resolverFn
 * @param typeGuard
 * @returns
 */
const resolveAndFilterArray = async <T extends string | IDocument>(
  items: DangerousArray,
  resolverFn: ResolveFn<T>,
  typeGuard: (item: unknown) => item is T,
  depth: number,
) => {
  const promises = items
    .filter((item): item is T | string => !!item)
    .map(item => resolverFn(toDocument(item), depth));
  const resolved = await Promise.all(promises);
  const filtered = resolved.filter(item => !!item).filter(typeGuard);
  return filtered.map(withStringId);
};

/**
 * Resolves properties of an object and removes any properties that are falsy
 * @param obj
 * @param resolverFn
 * @param typeGuard
 */
const resolveObjectProperties = async <T>(
  obj: { [key: string]: unknown },
  resolverFn: ResolveFn<T>,
  typeGuard: (item: any) => item is T,
  depth: number,
): Promise<void> => {
  for (const [id, undetermined] of Object.entries(obj)) {
    if (!undetermined) continue;

    let item =
      typeof undetermined === 'object' && undetermined !== null && isDocument(undetermined)
        ? (undetermined as ServerDocument<T>)
        : undefined;

    item ??=
      typeof undetermined === 'string' || undetermined instanceof ObjectId
        ? ({ _id: new ObjectId(undetermined.toString()) } as ServerDocument<T>)
        : undefined;

    if (!item) continue;

    const resolved = await resolverFn(item, depth);
    if (resolved && typeGuard(resolved)) {
      obj[id] = withStringId(resolved);
    } else {
      delete obj[id];
    }
  }
};

/**
 * Resolves a document if it is unresolved
 * @param obj
 * @param collection
 * @param isTypeGuard
 * @returns
 */
const resolveDocument = async <T extends ServerDocument<T>>(
  obj: ServerDocument<IDocument | T>,
  collection: DbCollection<T>,
  isTypeGuard: (obj: any) => obj is T,
): Promise<ServerDocument<T> | undefined> => {
  const entity = isUnresolved(obj)
    ? await collection.findOne({ _id: new ObjectId(obj._id) } as any) // TODO: Figure out type error
    : isTypeGuard(obj)
      ? obj
      : undefined;
  return entity || undefined;
};

/**
 * Creates a resolver for a specific collection.
 * @param collection
 * @param isTypeGuard
 * @param additionalProcessing
 * @returns
 */
const createResolver = <T extends ServerDocument<T>>(
  collection: DbCollection<T>,
  isTypeGuard: (obj: unknown) => obj is T,
  additionalProcessing?: ResolverFunction<T>,
): ResolveFn<T> => {
  return async (obj: ServerDocument<T>, depth: number = RESOLVE_FULL_DEPTH) => {
    const cachedEntity = obj?._id
      ? await entitiesCache
          .get<ServerDocument<T>>(`${collection.collectionName}::${obj._id}`)
          .catch(error => {
            err(`Error fetching entity from cache: ${error.toString()}`);
            return undefined;
          })
      : undefined;
    const entity =
      cachedEntity ??
      (await resolveDocument(obj, collection, isTypeGuard).catch(error => {
        err(`Error resolving document: ${error.toString()}`);
        return undefined;
      }));

    if (!entity) return undefined;

    await entitiesCache.set(`${collection.collectionName}::${entity._id}`, entity).catch(error => {
      err(`Error caching document: ${error.toString()}`);
      return undefined;
    });

    // log(`Running onResolve hooks ${collection.collectionName} ${entity._id}`);
    const transformed = await HookManager.runHooks(
      collection.collectionName as Collection,
      'onResolve',
      entity,
    );
    transformed._id = entity._id; // Ensure _id remains of type ObjectId
    // log(`Finished onResolve hooks ${collection.collectionName} ${entity._id}`);

    if (additionalProcessing && depth > 0) {
      return await additionalProcessing(transformed, depth - 1).catch(error => {
        err(`Failed running additional processing on entity: ${error.toString()}`);
        return undefined;
      });
    }

    return transformed;
  };
};

export const resolveGroup: ResolveFn<IGroup> = createResolver(groupCollection, isGroup);
export const resolveTag: ResolveFn<ITag> = createResolver(tagCollection, isTag);
export const resolveAddress: ResolveFn<IAddress> = createResolver(addressCollection, isAddress);
export const resolveContact: ResolveFn<IContact> = createResolver(contactCollection, isContact);
export const resolveAnnotation: ResolveFn<IAnnotation> = createResolver(
  annotationCollection,
  isAnnotation,
);

export const resolvePerson: ResolveFn<IPerson> = createResolver(
  personCollection,
  isPerson,
  async (entity, depth) => {
    await resolveObjectProperties(
      entity.contact_references ?? {},
      resolveContact,
      isContact,
      depth,
    );
    for (const [id, institutions] of Object.entries(entity.institutions ?? {})) {
      entity.institutions[id] = await resolveAndFilterArray(
        institutions ?? [],
        resolveInstitution,
        isInstitution,
        depth,
      );
    }
    return entity;
  },
);

export const resolveInstitution: ResolveFn<IInstitution> = createResolver(
  institutionCollection,
  isInstitution,
  async (entity, depth) => {
    await resolveObjectProperties(entity.addresses ?? {}, resolveAddress, isAddress, depth);
    return entity;
  },
);

export const resolvePhysicalEntity: ResolveFn<IPhysicalEntity> = createResolver(
  physicalEntityCollection,
  isPhysicalEntity,
  async (entity, depth) => {
    const withResolvedBase = await resolveMetadataEntity(entity, depth);
    return withResolvedBase;
  },
);

export const resolveDigitalEntity: ResolveFn<IDigitalEntity> = createResolver(
  digitalEntityCollection,
  isDigitalEntity,
  async (entity, depth) => {
    entity.tags = await resolveAndFilterArray(entity.tags ?? [], resolveTag, isTag, depth);
    entity.phyObjs = await resolveAndFilterArray(
      entity.phyObjs ?? [],
      resolvePhysicalEntity,
      isPhysicalEntity,
      depth,
    );
    const withResolvedBase = await resolveMetadataEntity(entity, depth);
    return withResolvedBase;
  },
);

export const resolveEntity: ResolveFn<IEntity> = createResolver(
  entityCollection,
  isEntity,
  async (entity, depth) => {
    await resolveObjectProperties(entity.annotations, resolveAnnotation, isAnnotation, depth);
    const seperateAnnotations = await annotationCollection
      .find({
        'target.source.relatedEntity': entity._id.toString(),
        '$or': [
          { 'target.source.relatedCompilation': { $exists: false } },
          { 'target.source.relatedCompilation': '' },
        ],
      })
      .toArray();
    for (const annotation of seperateAnnotations) {
      entity.annotations[annotation._id.toString()] = annotation as IAnnotation;
    }
    if (entity.relatedDigitalEntity && !isDigitalEntity(entity.relatedDigitalEntity)) {
      const resolved = await resolveDigitalEntity(entity.relatedDigitalEntity, depth);
      if (resolved) entity.relatedDigitalEntity = withStringId(resolved);
    }
    return entity;
  },
);

export const resolveCompilation: ResolveFn<ICompilation> = createResolver(
  compilationCollection,
  isCompilation,
  async (entity, depth) => {
    const seperateAnnotations = await annotationCollection
      .find({ 'target.source.relatedCompilation': entity._id.toString() })
      .toArray();
    for (const annotation of seperateAnnotations) {
      entity.annotations[annotation._id.toString()] = annotation as IAnnotation;
    }
    await resolveObjectProperties(entity.entities, resolveEntity, isEntity, depth);
    return entity;
  },
);

export const resolveAny = async <T extends Collection>(
  collection: T,
  obj: Parameters<ResolveFn<unknown>>[0],
  depth: number = RESOLVE_FULL_DEPTH,
): Promise<ServerDocument<IDocument> | undefined> => {
  switch (collection) {
    case Collection.entity:
      return resolveEntity(obj, depth);
    case Collection.group:
      return resolveGroup(obj, depth);
    case Collection.address:
      return resolveAddress(obj, depth);
    case Collection.annotation:
      return resolveAnnotation(obj, depth);
    case Collection.compilation:
      return resolveCompilation(obj, depth);
    case Collection.contact:
      return resolveContact(obj, depth);
    case Collection.digitalentity:
      return resolveDigitalEntity(obj, depth);
    case Collection.institution:
      return resolveInstitution(obj, depth);
    case Collection.person:
      return resolvePerson(obj, depth);
    case Collection.physicalentity:
      return resolvePhysicalEntity(obj, depth);
    case Collection.tag:
      return resolveTag(obj, depth);
    default:
      return undefined;
  }
};
