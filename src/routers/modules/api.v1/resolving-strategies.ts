import { ObjectId, type WithId, type Collection as DbCollection } from 'mongodb';
import {
  Collection,
  isAddress,
  isAnnotation,
  isCompilation,
  isContact,
  isDigitalEntity,
  isEntity,
  isGroup,
  isInstitution,
  isPerson,
  isPhysicalEntity,
  isTag,
  isUnresolved,
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
} from 'src/common';
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

type ResolveFn<T> = (obj: ServerDocument<IDocument | T>) => Promise<ServerDocument<T> | undefined>;
type DangerousArray = (IDocument | string | undefined | null)[];

// TODO: Can this method be removed?
const withStringId = <T extends { _id: string | ObjectId }>(entity: T): { _id: string } & T => ({
  ...entity,
  _id: entity._id.toString(),
});

const toDocument = <T extends IDocument>(obj: string | T): IDocument =>
  typeof obj === 'string' ? { _id: obj } : obj;

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
) => {
  return (
    await Promise.all(
      items.filter(Boolean).map(async item => {
        const resolved = await resolverFn(toDocument(item!));
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
) => {
  if (!entity || !entity._id) return entity;
  const entityId = entity._id.toString();

  entity.persons = await resolveAndCleanRelatedEntities(
    entity.persons ?? [],
    resolvePerson,
    entityId,
  );
  entity.institutions = await resolveAndCleanRelatedEntities(
    entity.institutions ?? [],
    resolveInstitution,
    entityId,
  );

  return entity;
};

type ResolverFunction<T extends ServerDocument<T>> = (
  entity: ServerDocument<T>,
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
  typeGuard: (item: any) => item is T,
) => {
  const promises = items
    .filter((item): item is T | string => !!item)
    .map(item => resolverFn(toDocument(item)));
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
  obj: { [key: string]: any },
  resolverFn: ResolveFn<T>,
  typeGuard: (item: any) => item is T,
): Promise<void> => {
  for (const [id, item] of Object.entries(obj)) {
    if (!item) continue;
    const resolved = await resolverFn(item);
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
  return async (obj: any) => {
    const cachedEntity = (!!obj?._id) ? (await entitiesCache.get<ServerDocument<T>>((`${collection.collectionName}::${obj._id}`))) : undefined;
    const entity = cachedEntity ?? await resolveDocument(obj, collection, isTypeGuard);
    if (!entity) return undefined;

    await entitiesCache.set(`${collection.collectionName}::${entity._id}`, entity);

    if (additionalProcessing) {
      return await additionalProcessing(entity);
    }

    return entity;
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
  async entity => {
    await resolveObjectProperties(entity.contact_references ?? {}, resolveContact, isContact);
    for (const [id, institutions] of Object.entries(entity.institutions ?? {})) {
      entity.institutions[id] = await resolveAndFilterArray(
        institutions ?? [],
        resolveInstitution,
        isInstitution,
      );
    }
    return entity;
  },
);

export const resolveInstitution: ResolveFn<IInstitution> = createResolver(
  institutionCollection,
  isInstitution,
  async entity => {
    await resolveObjectProperties(entity.addresses ?? {}, resolveAddress, isAddress);
    return entity;
  },
);

export const resolvePhysicalEntity: ResolveFn<IPhysicalEntity> = createResolver(
  physicalEntityCollection,
  isPhysicalEntity,
  async entity => {
    const withResolvedBase = await resolveMetadataEntity(entity);
    return withResolvedBase;
  },
);

export const resolveDigitalEntity: ResolveFn<IDigitalEntity> = createResolver(
  digitalEntityCollection,
  isDigitalEntity,
  async entity => {
    entity.tags = await resolveAndFilterArray(entity.tags ?? [], resolveTag, isTag);
    entity.phyObjs = await resolveAndFilterArray(
      entity.phyObjs ?? [],
      resolvePhysicalEntity,
      isPhysicalEntity,
    );
    const withResolvedBase = await resolveMetadataEntity(entity);
    return withResolvedBase;
  },
);

export const resolveEntity: ResolveFn<IEntity> = createResolver(
  entityCollection,
  isEntity,
  async entity => {
    await resolveObjectProperties(entity.annotations, resolveAnnotation, isAnnotation);
    if (entity.relatedDigitalEntity && !isDigitalEntity(entity.relatedDigitalEntity)) {
      const resolved = await resolveDigitalEntity(entity.relatedDigitalEntity);
      if (resolved) entity.relatedDigitalEntity = withStringId(resolved);
    }
    return entity;
  },
);

export const resolveCompilation: ResolveFn<ICompilation> = createResolver(
  compilationCollection,
  isCompilation,
  async entity => {
    await resolveObjectProperties(entity.entities, resolveEntity, isEntity);
    return entity;
  },
);

export const resolveAny = async <T extends Collection>(
  collection: T,
  obj: Parameters<ResolveFn<unknown>>[0],
): Promise<ServerDocument<IDocument> | undefined> => {
  switch (collection) {
    case Collection.entity:
      return resolveEntity(obj);
    case Collection.group:
      return resolveGroup(obj);
    case Collection.address:
      return resolveAddress(obj);
    case Collection.annotation:
      return resolveAnnotation(obj);
    case Collection.compilation:
      return resolveCompilation(obj);
    case Collection.contact:
      return resolveContact(obj);
    case Collection.digitalentity:
      return resolveDigitalEntity(obj);
    case Collection.institution:
      return resolveInstitution(obj);
    case Collection.person:
      return resolvePerson(obj);
    case Collection.physicalentity:
      return resolvePhysicalEntity(obj);
    case Collection.tag:
      return resolveTag(obj);
    default:
      return undefined;
  }
};
