import {
  Collection,
  isCompilation,
  isContact,
  isDigitalEntity,
  isEntity,
  isInstitution,
  isPerson,
  isPhysicalEntity,
  isUnresolved,
  type ICompilation,
  type IContact,
  type IDigitalEntity,
  type IDocument,
  type IEntity,
  type IGroup,
  type IInstitution,
  type IPerson,
  type IPhysicalEntity,
  type IUserData,
} from 'src/common';
import { ObjectId, type Collection as DbCollection } from 'mongodb';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
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
import { err, log } from 'src/logger';
import { makeUserOwnerOf } from '../user-management/users';

type SavingFn<T> = (obj: ServerDocument<IDocument | T>) => Promise<ServerDocument<T> | undefined>;
type DangerousArray<T> = (T | string | undefined | null)[];
type SavingFunction<T extends ServerDocument<T>> = (
  entity: ServerDocument<T>,
) => Promise<T | undefined>;
type TransformFn<T> = (obj: ServerDocument<IDocument>) => Promise<Partial<T>>;

const flattenRecordArray = (obj?: Record<string, any>): Record<string, IDocument[]> => {
  if (!obj) return {};
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.map(flattenDocument) : [],
    ]),
  );
};

const isDocument = (obj?: unknown) =>
  !!obj && typeof obj === 'object' && !Array.isArray(obj) && Object.hasOwn(obj, '_id');

const flattenRecord = (obj?: Record<string, unknown>): Record<string, IDocument> => {
  if (!obj) return {};
  return Object.fromEntries(
    Object.entries(obj)
      .filter(
        (arr): arr is [string, string | IDocument] =>
          typeof arr[1] === 'string' || isDocument(arr[1]),
      )
      .map(([key, value]) => [key, flattenDocument(value)]),
  );
};

const flattenDocument = (obj: (Record<string, any> & IDocument) | string): IDocument => {
  return { _id: typeof obj === 'string' ? obj : obj._id } satisfies IDocument;
};

const flattenDocumentArray = (
  arr?: ((Record<string, any> & IDocument) | string)[],
): IDocument[] => {
  if (!arr) return [];
  return arr.map(doc => flattenDocument(doc));
};

const transformDocument: TransformFn<any> = async <T>(body: ServerDocument<IDocument | T>) => {
  const asDocument = body as unknown as Partial<T>;
  return asDocument;
};

const transformEntity: TransformFn<IEntity> = async body => {
  const asEntity = body as unknown as Partial<IEntity>;
  return {
    annotations: flattenRecord(asEntity.annotations),
    creator: asEntity.creator,
    dataSource: asEntity.dataSource,
    externalFile: asEntity.externalFile,
    files: asEntity.files,
    finished: asEntity.finished,
    mediaType: asEntity.mediaType,
    name: asEntity.name,
    online: asEntity.online,
    processed: asEntity.processed,
    relatedDigitalEntity: asEntity.relatedDigitalEntity
      ? flattenDocument(asEntity.relatedDigitalEntity)
      : flattenDocument({ _id: new ObjectId().toString() }),
    settings: asEntity.settings,
    whitelist: asEntity.whitelist,
  };
};

const transformDigitalEntity: TransformFn<IDigitalEntity> = async body => {
  const asDigitalEntity = body as unknown as Partial<IDigitalEntity>;
  return {
    biblioRefs: asDigitalEntity.biblioRefs ?? [],
    creation: asDigitalEntity.creation ?? [],
    description: asDigitalEntity.description ?? '',
    externalId: asDigitalEntity.externalId ?? [],
    dimensions: asDigitalEntity.dimensions ?? [],
    discipline: asDigitalEntity.discipline ?? [],
    externalLink: asDigitalEntity.externalLink ?? [],
    files: asDigitalEntity.files ?? [],
    licence: asDigitalEntity.licence ?? '',
    metadata_files: asDigitalEntity.metadata_files ?? [],
    objecttype: asDigitalEntity.objecttype ?? '',
    other: asDigitalEntity.other ?? [],
    statement: asDigitalEntity.statement ?? '',
    title: asDigitalEntity.title ?? '',
    type: asDigitalEntity.type ?? '',
    institutions: flattenDocumentArray(asDigitalEntity.institutions),
    persons: flattenDocumentArray(asDigitalEntity.persons),
    phyObjs: flattenDocumentArray(asDigitalEntity.phyObjs),
    tags: flattenDocumentArray(asDigitalEntity.tags),
  };
};

const transformCompilation: TransformFn<ICompilation> = async body => {
  const asCompilation = body as unknown as Partial<ICompilation>;
  return {
    annotations: flattenRecord(asCompilation.annotations),
    creator: asCompilation.creator,
    description: asCompilation.description ?? '',
    entities: flattenRecord(asCompilation.entities),
    name: asCompilation.name ?? '',
    password: asCompilation.password ?? '',
    // TODO: handle nested fields in whitelist
    whitelist: asCompilation.whitelist ?? {
      enabled: false,
      groups: [],
      persons: [],
    },
  };
};

const transformInstitution: TransformFn<IInstitution> = async body => {
  const asInstitution = body as unknown as Partial<IInstitution>;

  const existing = asInstitution._id ? await institutionCollection.findOne({ _id: new ObjectId(asInstitution._id)}) : undefined;

  const combinedAddresses = {
    ...flattenRecord(existing?.addresses ?? {}),
    ...flattenRecord(asInstitution.addresses),
  };

  return {
    addresses: combinedAddresses,
    name: asInstitution.name,
    notes: asInstitution.notes,
    roles: asInstitution.roles,
    university: asInstitution.university,
  };
};

const transformPerson: TransformFn<IPerson> = async body => {
  const asPerson = body as unknown as Partial<IPerson>;

  const existing = asPerson._id ? await personCollection.findOne({ _id: new ObjectId(asPerson._id)}) : undefined;

  log(`Transforming person ${asPerson._id}`, asPerson.contact_references, flattenRecord(asPerson.contact_references));

  const combinedContactReferences = {
    ...flattenRecord(existing?.contact_references ?? {}),
    ...flattenRecord(asPerson.contact_references),
  };

  const combinedInstitutions: Record<string, IDocument[]> = flattenRecordArray(existing?.institutions ?? {});
  for (const [key, arr] of Object.entries(flattenRecordArray(asPerson.institutions))) {
    combinedInstitutions[key] = [...(combinedInstitutions[key] ?? []), ...arr];
  }

  return {
    contact_references: combinedContactReferences,
    name: asPerson.name,
    prename: asPerson.prename,
    roles: asPerson.roles,
    institutions: combinedInstitutions,
  };
};

const transformPhysicalEntity: TransformFn<IPhysicalEntity> = async body => {
  const asPhysicalEntity = body as unknown as Partial<IPhysicalEntity>;
  return {
    biblioRefs: asPhysicalEntity.biblioRefs ?? [],
    description: asPhysicalEntity.description ?? '',
    externalId: asPhysicalEntity.externalId ?? [],
    externalLink: asPhysicalEntity.externalLink ?? [],
    metadata_files: asPhysicalEntity.metadata_files ?? [],
    other: asPhysicalEntity.other ?? [],
    title: asPhysicalEntity.title ?? '',
    collection: asPhysicalEntity.collection ?? '',
    institutions: flattenDocumentArray(asPhysicalEntity.institutions),
    persons: flattenDocumentArray(asPhysicalEntity.persons),
    place: {
      name: asPhysicalEntity.place?.name ?? '',
      geopolarea: asPhysicalEntity.place?.geopolarea ?? '',
      // TODO: This address is not nested in the frontend or in the database. Should it be?
      address: asPhysicalEntity.place?.address ?? {
        _id: new ObjectId().toString(),
        building: '',
        city: '',
        country: '',
        creation_date: 0,
        number: '',
        postcode: '',
        street: '',
      },
    },
  };
};

const createSaver = <T extends ServerDocument<T>>(
  collection: DbCollection<T>,
  transform: TransformFn<T>,
  additionalProcessing?: (
    obj: ServerDocument<IDocument>,
    userdata: ServerDocument<IUserData>,
  ) => Promise<unknown>,
) => {
  return async (
    obj: ServerDocument<IDocument> | string | undefined,
    userdata: ServerDocument<IUserData>,
  ) => {
    if (!obj) {
      return false;
    }
    
    // Assume it is already saved and does not need to be saved
    if (typeof obj === 'string' || isUnresolved(obj)) {
      return true;
    }
    
    // If the _id is empty, create a new one 
    if (obj._id.toString().length === 0) {
      obj._id = new ObjectId().toString();
    }

    log(`Saving ${obj._id} to ${collection.collectionName}`);

    log(`Making user owner of ${obj._id} to ${collection.collectionName}`);
    await makeUserOwnerOf({
      docs: obj,
      collection: collection.collectionName as Collection,
      userdata,
    }).catch(error => {
      err(`Error making user owner of ${obj._id} to ${collection.collectionName}`, error);
    });

    if (additionalProcessing) {
      log(`Running additional processing on ${obj._id}`);
      await additionalProcessing(obj, userdata).catch(error => {
        err(`Error running additional processing on ${obj._id}`, error);
      });
      log(`Finished additional processing on ${obj._id}`);
    }
    log(`Transforming ${obj._id}`);
    const transformed = await transform(structuredClone(obj));
    log(`Transformed ${obj._id}`);
    log(`Saving ${obj._id}`);
    delete transformed._id;
    return await collection
      .updateOne({ _id: new ObjectId(obj._id) } as any, { $set: transformed }, { upsert: true })
      .then(result => {
        log(`Saved ${obj._id}`, result);
        return result.modifiedCount + result.upsertedCount > 0 || result.matchedCount > 0;
      })
      .catch(error => {
        err(`Error saving ${obj._id}`, error);
        return false;
      });
  };
};

// TODO: Check strategies against old strategies, to see whats missing from transformers
const addressSaver = createSaver(addressCollection, transformDocument);
const annotationSaver = createSaver(annotationCollection, transformDocument);
const contactSaver = createSaver(contactCollection, transformDocument);
const groupSaver = createSaver(groupCollection, transformDocument);
const tagSaver = createSaver(tagCollection, transformDocument);

const compilationSaver = createSaver(
  compilationCollection,
  transformCompilation,
  async (obj, userdata) => {
    if (!isCompilation(obj)) return;
    return Promise.all([
      ...Object.values(obj.annotations).map(annotation => annotationSaver(annotation, userdata)),
      ...Object.values(obj.entities).map(entity => entitySaver(entity, userdata)),
    ]);
  },
);

const digitalEntitySaver = createSaver(
  digitalEntityCollection,
  transformDigitalEntity,
  async (obj, userdata) => {
    if (!isDigitalEntity(obj)) return;
    return Promise.all([
      ...Object.values(obj.institutions).map(institution =>
        institutionSaver(institution, userdata),
      ),
      ...Object.values(obj.persons).map(person => personSaver(person, userdata)),
      ...Object.values(obj.phyObjs).map(physicalEntity =>
        physicalEntitySaver(physicalEntity, userdata),
      ),
      ...Object.values(obj.tags).map(tag => tagSaver(tag, userdata)),
    ]);
  },
);

const entitySaver = createSaver(entityCollection, transformEntity, async (obj, userdata) => {
  if (!isEntity(obj)) return;
  return Promise.all([
    ...Object.values(obj.annotations).map(annotation => annotationSaver(annotation, userdata)),
    digitalEntitySaver(obj.relatedDigitalEntity, userdata),
  ]);
});

const institutionSaver = createSaver(
  institutionCollection,
  transformInstitution,
  async (obj, userdata) => {
    if (!isInstitution(obj)) return;
    return Promise.all([
      ...Object.values(obj.addresses).map(address => addressSaver(address, userdata)),
    ]);
  },
);

const personSaver = createSaver(personCollection, transformPerson, async (obj, userdata) => {
  if (!isPerson(obj)) return;
  return Promise.all([
    ...Object.values(obj.institutions)
      .flat()
      .map(institution => institutionSaver(institution, userdata)),
    ...Object.values(obj.contact_references).map(contact => contactSaver(contact, userdata)),
  ]);
});

const physicalEntitySaver = createSaver(
  physicalEntityCollection,
  transformPhysicalEntity,
  async (obj, userdata) => {
    if (!isPhysicalEntity(obj)) return;
    return Promise.all([
      ...Object.values(obj.institutions).map(institution =>
        institutionSaver(institution, userdata),
      ),
      ...Object.values(obj.persons).map(person => personSaver(person, userdata)),
    ]);
  },
);

export const saveHandler = async ({
  collection,
  body,
  userdata,
}: {
  collection: Collection;
  body: IDocument;
  userdata: ServerDocument<IUserData>;
}) => {
  switch (collection) {
    case Collection.address:
      return addressSaver(body, userdata);
    case Collection.annotation:
      return annotationSaver(body, userdata);
    case Collection.compilation:
      return compilationSaver(body, userdata);
    case Collection.contact:
      return contactSaver(body, userdata);
    case Collection.digitalentity:
      return digitalEntitySaver(body, userdata);
    case Collection.entity:
      return entitySaver(body, userdata);
    case Collection.group:
      return groupSaver(body, userdata);
    case Collection.institution:
      return institutionSaver(body, userdata);
    case Collection.person:
      return personSaver(body, userdata);
    case Collection.physicalentity:
      return physicalEntitySaver(body, userdata);
    case Collection.tag:
      return tagSaver(body, userdata);
  }
};
