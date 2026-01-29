import { type Collection as DbCollection, ObjectId } from 'mongodb';
import {
  Collection,
  EntityAccessRole,
  type IAnnotation,
  type ICompilation,
  type IDigitalEntity,
  type IDocument,
  type IEntity,
  type IInstitution,
  type IPerson,
  type IPhysicalEntity,
  type IUserData,
  isCompilation,
  isDigitalEntity,
  isEntity,
  isInstitution,
  isPerson,
  isPhysicalEntity,
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
  institutionCollection,
  personCollection,
  physicalEntityCollection,
  tagCollection,
} from 'src/mongo';
import { entitiesCache, resolveCache } from 'src/redis';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import { MAX_PREVIEW_IMAGE_RESOLUTION, updatePreviewImage } from 'src/util/image-helpers';
import { stripUser } from 'src/util/userdata-transformation';
import { makeUserOwnerOf } from '../user-management/users';
import { HookManager } from './hooks';
import { saveMetadataFiles } from 'src/util/save-metadata-files';

type TransformFn<T> = (
  obj: ServerDocument<IDocument>,
  user: ServerDocument<IUserData>,
) => Promise<Partial<T>>;

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

const transformAnnotation: TransformFn<IAnnotation> = async (body, user) => {
  const asAnnotation = body as unknown as Partial<IAnnotation>;

  try {
    asAnnotation!.body!.content!.relatedPerspective!.preview = await updatePreviewImage(
      asAnnotation!.body!.content!.relatedPerspective!.preview,
      'annotation',
      asAnnotation._id!,
      MAX_PREVIEW_IMAGE_RESOLUTION,
    );
  } catch (error) {
    err('Error updating preview image:', error);
  }

  return asAnnotation;
};

const transformEntity: TransformFn<IEntity> = async (body, user) => {
  const asEntity = body as unknown as Partial<IEntity>;

  const strippedUser = stripUser(user);

  const digitalEntity = asEntity.relatedDigitalEntity?._id
    ? await digitalEntityCollection.findOne({
        _id: new ObjectId(asEntity.relatedDigitalEntity._id),
      })
    : undefined;

  return {
    __hits: asEntity.__hits ?? 0,
    __createdAt: asEntity.__createdAt ?? new ObjectId(asEntity._id).getTimestamp().getTime(),
    __normalizedName: asEntity.name?.trim().toLowerCase() ?? '',
    __annotationCount: Object.keys(asEntity.annotations || {}).length,
    __downloadable: asEntity.__downloadable ?? asEntity.options?.allowDownload ?? false,
    __licenses:
      digitalEntity && 'licence' in digitalEntity
        ? [digitalEntity.licence]
        : (asEntity.__licenses ?? []),
    __mediaTypes: asEntity.__mediaTypes ?? (asEntity.mediaType ? [asEntity.mediaType] : []),
    _id: asEntity._id,
    annotations: flattenRecord(asEntity.annotations),
    creator: asEntity.creator ?? strippedUser,
    dataSource: asEntity.dataSource,
    externalFile: asEntity.externalFile,
    files: asEntity.files,
    finished: asEntity.finished,
    mediaType: asEntity.mediaType,
    name: asEntity.name,
    online: asEntity.online,
    processed: asEntity.processed,
    relatedDigitalEntity: flattenDocument({
      _id: digitalEntity?._id.toString() ?? new ObjectId().toString(),
    }),
    settings: {
      ...asEntity.settings!,
      preview:
        asEntity.settings?.preview && asEntity._id
          ? await updatePreviewImage(
              asEntity.settings?.preview,
              'entity',
              asEntity._id,
              MAX_PREVIEW_IMAGE_RESOLUTION,
            )
          : asEntity.settings?.preview!,
    },
    whitelist: asEntity.whitelist,
    access: asEntity.access ?? {
      [strippedUser._id]: {
        ...strippedUser,
        role: EntityAccessRole.owner,
      },
    },
    options: asEntity.options ?? {
      allowDownload: false,
    },
  };
};

const transformDigitalEntity: TransformFn<IDigitalEntity> = async body => {
  const asDigitalEntity = body as unknown as Partial<IDigitalEntity>;
  return {
    _id: asDigitalEntity._id,
    biblioRefs: asDigitalEntity.biblioRefs ?? [],
    creation: asDigitalEntity.creation ?? [],
    description: asDigitalEntity.description ?? '',
    externalId: asDigitalEntity.externalId ?? [],
    dimensions: asDigitalEntity.dimensions ?? [],
    discipline: asDigitalEntity.discipline ?? [],
    externalLink: asDigitalEntity.externalLink ?? [],
    files: asDigitalEntity.files ?? [],
    licence: asDigitalEntity.licence ?? '',
    metadata_files: await saveMetadataFiles(
      asDigitalEntity._id!,
      asDigitalEntity.metadata_files ?? [],
    ),
    objecttype: asDigitalEntity.objecttype ?? '',
    other: asDigitalEntity.other ?? [],
    statement: asDigitalEntity.statement ?? '',
    title: asDigitalEntity.title ?? '',
    type: asDigitalEntity.type ?? '',
    institutions: flattenDocumentArray(asDigitalEntity.institutions),
    persons: flattenDocumentArray(asDigitalEntity.persons),
    phyObjs: flattenDocumentArray(asDigitalEntity.phyObjs),
    tags: flattenDocumentArray(asDigitalEntity.tags),
    extensions: asDigitalEntity.extensions ?? {},
  };
};

const transformCompilation: TransformFn<ICompilation> = async (body, user) => {
  const asCompilation = body as unknown as Partial<ICompilation>;

  const strippedUser = stripUser(user);

  // NOTE: We update the filterable properties using hook running in the background after save
  // This means that there might be a slight delay when filtering, but it should not be noticeable
  // and it avoids slowing down the save operation significantly
  // See: `src/jobs/ensure-filterable-properties.ts`

  return {
    __hits: asCompilation.__hits ?? 0,
    __createdAt:
      asCompilation.__createdAt ?? new ObjectId(asCompilation._id).getTimestamp().getTime(),
    __normalizedName: asCompilation.name?.trim().toLowerCase() ?? '',
    __annotationCount: Object.keys(asCompilation.annotations || {}).length,
    __downloadable: asCompilation.__downloadable ?? false,
    __licenses: asCompilation.__licenses ?? [],
    __mediaTypes: asCompilation.__mediaTypes ?? [],
    _id: asCompilation._id,
    annotations: flattenRecord(asCompilation.annotations),
    creator: asCompilation.creator,
    description: asCompilation.description ?? '',
    entities: flattenRecord(asCompilation.entities),
    name: asCompilation.name ?? '',
    password: asCompilation.password ?? '',
    whitelist: asCompilation.whitelist,
    access: asCompilation.access ?? {
      [strippedUser._id]: {
        ...strippedUser,
        role: EntityAccessRole.owner,
      },
    },
  };
};

const transformInstitution: TransformFn<IInstitution> = async body => {
  const asInstitution = body as unknown as Partial<IInstitution>;

  const existing = asInstitution._id
    ? await institutionCollection.findOne({ _id: new ObjectId(asInstitution._id) })
    : undefined;

  const combinedAddresses = {
    ...flattenRecord(existing?.addresses ?? {}),
    ...flattenRecord(asInstitution.addresses),
  };

  return {
    _id: asInstitution._id,
    addresses: combinedAddresses,
    name: asInstitution.name,
    notes: asInstitution.notes,
    roles: asInstitution.roles,
    university: asInstitution.university,
  };
};

const transformPerson: TransformFn<IPerson> = async body => {
  const asPerson = body as unknown as Partial<IPerson>;

  const existing = asPerson._id
    ? await personCollection.findOne({ _id: new ObjectId(asPerson._id) })
    : undefined;

  log(
    `Transforming person ${asPerson._id}`,
    asPerson.contact_references,
    flattenRecord(asPerson.contact_references),
  );

  const combinedContactReferences = {
    ...flattenRecord(existing?.contact_references ?? {}),
    ...flattenRecord(asPerson.contact_references),
  };

  const combinedInstitutions: Record<string, IDocument[]> = flattenRecordArray(
    existing?.institutions ?? {},
  );
  for (const [key, arr] of Object.entries(flattenRecordArray(asPerson.institutions))) {
    combinedInstitutions[key] = [...(combinedInstitutions[key] ?? []), ...arr];
  }

  return {
    _id: asPerson._id,
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
    _id: asPhysicalEntity._id,
    biblioRefs: asPhysicalEntity.biblioRefs ?? [],
    description: asPhysicalEntity.description ?? '',
    externalId: asPhysicalEntity.externalId ?? [],
    externalLink: asPhysicalEntity.externalLink ?? [],
    metadata_files: await saveMetadataFiles(
      asPhysicalEntity._id!,
      asPhysicalEntity.metadata_files ?? [],
    ),
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

    log(`Running Saver for ${obj._id} to ${collection.collectionName}`);
    entitiesCache.del(`${collection.collectionName}::${obj._id}`);

    if (additionalProcessing) {
      log(`Running additional processing on ${collection.collectionName} ${obj._id}`);
      await additionalProcessing(obj, userdata).catch(error => {
        err(
          `Error running additional processing on ${collection.collectionName} ${obj._id}`,
          error,
        );
      });
      log(`Finished additional processing on ${collection.collectionName} ${obj._id}`);
    }
    log(`Transforming ${collection.collectionName} ${obj._id}`);
    const transformedPreHook = await transform(structuredClone(obj), userdata);
    log(`Transformed ${collection.collectionName} ${obj._id}`);

    log(`Running onTransform hooks ${collection.collectionName} ${obj._id}`);
    const transformed = (await HookManager.runHooks(
      collection.collectionName as Collection,
      'onTransform',
      transformedPreHook as T,
      userdata,
    )) as Partial<T>;
    log(`Finished onTransform hooks ${collection.collectionName} ${obj._id}`);

    log(`Saving ${collection.collectionName} ${obj._id}`);
    transformed._id = undefined;
    delete transformed._id;
    const saved = await collection
      .updateOne({ _id: new ObjectId(obj._id) } as any, { $set: transformed }, { upsert: true })
      .then(result => {
        log(`Saved ${collection.collectionName} ${obj._id}`, result);
        return result.modifiedCount + result.upsertedCount > 0 || result.matchedCount > 0;
      })
      .catch(error => {
        err(`Error saving ${collection.collectionName} ${obj._id}`, error);
        return false;
      });
    log(`Running afterSave hooks ${collection.collectionName} ${obj._id}`);
    await HookManager.runHooks(
      collection.collectionName as Collection,
      'afterSave',
      { ...transformed, _id: obj._id } as T,
      userdata,
    );
    log(`Finished afterSave hooks ${collection.collectionName} ${obj._id}`);
    return saved;
  };
};

// TODO: Check strategies against old strategies, to see whats missing from transformers
const addressSaver = createSaver(addressCollection, transformDocument);
const annotationSaver = createSaver(annotationCollection, transformAnnotation);
const contactSaver = createSaver(contactCollection, transformDocument);
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
