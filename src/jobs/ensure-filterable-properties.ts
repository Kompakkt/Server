import { ObjectId } from 'mongodb';
import { Collection, type IDigitalEntity, type IEntity } from 'src/common';
import { log } from 'src/logger';
import { compilationCollection, entityCollection, profileCollection } from 'src/mongo';
import { HookManager } from 'src/routers/modules/api.v1/hooks';
import {
  resolveDigitalEntity,
  resolveEntity,
} from 'src/routers/modules/api.v1/resolving-strategies';
import { saveHandler } from 'src/routers/modules/api.v1/save-to-collection';
import type { ServerDocument } from 'src/util/document-with-objectid-type';

/**
 * Ensures existence of all IFilterable properties on explore-able documents.
 */
export const ensureFilterableProperties = async () => {
  const collections = [entityCollection, compilationCollection, profileCollection];
  for (const collection of collections) {
    // TODO: Can change to cursor for less memory usage
    const entities = await collection
      .find({
        $or: [
          { __licenses: { $exists: false } },
          { __mediaTypes: { $exists: false } },
          { __downloadable: { $exists: false } },
          // Provided by ISortable
          // { __annotationCount: { $exists: false } },
        ],
      })
      .toArray();
    if (entities.length === 0) continue;
    log(
      `Found ${entities.length} entities in ${collection.collectionName} without filterable properties...`,
    );
    for (const entity of entities) {
      if (!entity.__licenses) {
        // For entities, we need to extract from relatedDigitalEntity
        if ('relatedDigitalEntity' in entity) {
          const digitalEntity = await resolveDigitalEntity(entity.relatedDigitalEntity, 0);
          if (digitalEntity && 'licence' in digitalEntity) {
            entity.__licenses = [digitalEntity.licence];
          }
        }
        // For compilations, we need to extract from all related entities
        else if ('entities' in entity) {
          const licencesSet = new Set<string>();
          for (const e of Object.values(entity.entities)) {
            if (typeof e === 'object' && e !== null && 'relatedDigitalEntity' in e) {
              const digitalEntity = await resolveDigitalEntity(e.relatedDigitalEntity, 0);
              if (digitalEntity && 'licence' in digitalEntity) {
                licencesSet.add(digitalEntity.licence);
              }
            }
          }
          entity.__licenses = Array.from(licencesSet);
        } else {
          // Profiles and others can not have licences
          entity.__licenses = [];
        }
      }

      if (!entity.__mediaTypes) {
        // For entities, we can extract directly
        if ('relatedDigitalEntity' in entity) {
          entity.__mediaTypes = [entity.mediaType];
        } else if ('entities' in entity) {
          // For compilations, we need to extract from all related entities
          const mediaTypesSet = new Set<string>();
          for (const e of Object.values(entity.entities)) {
            if (typeof e === 'object' && e !== null) {
              const resolved = await resolveEntity(entity, 0);
              if (resolved) {
                mediaTypesSet.add(resolved.mediaType);
              }
            }
          }
          entity.__mediaTypes = Array.from(mediaTypesSet);
        } else {
          // Profiles and others can not have media types
          entity.__mediaTypes = [];
        }
      }

      if (!entity.__downloadable) {
        // For entities, we can extract directly
        if ('relatedDigitalEntity' in entity) {
          entity.__downloadable = entity.options?.allowDownload === true;
        } else if ('entities' in entity) {
          // For compilations, we need to check if any related entity is downloadable
          let anyDownloadable = false;
          for (const e of Object.values(entity.entities)) {
            if (typeof e === 'object' && e !== null) {
              const resolved = await resolveEntity(entity, 0);
              if (resolved && resolved.options?.allowDownload === true) {
                anyDownloadable = true;
                break;
              }
            }
          }
          entity.__downloadable = anyDownloadable;
        } else {
          // Profiles and others can not be downloadable
          entity.__downloadable = false;
        }
      }

      await entityCollection.updateOne(
        { _id: entity._id },
        {
          $set: {
            __licenses: entity.__licenses,
            __mediaTypes: entity.__mediaTypes,
            __downloadable: entity.__downloadable,
          },
        },
      );
    }
  }
};

HookManager.addHook({
  collection: Collection.entity,
  type: 'afterSave',
  callback: async (entity: ServerDocument<IEntity>, userdata) => {
    if (!userdata) return entity;

    // NOTE: This updates compilations no matter whether anything relevant for them changed.
    // We don't need to wait for the hooks execution as they are just used for filtering
    queueMicrotask(async () => {
      log(`Entity ${entity._id} has changed filterable properties, updating compilations...`);

      // Update compilations containing this entity
      const compilations = await compilationCollection
        .find({ [`entities.${entity._id.toString()}`]: { $exists: true } })
        .toArray();
      for (const compilation of compilations) {
        // Recalculate compilation properties
        const licencesSet = new Set<string>();
        const mediaTypesSet = new Set<string>();
        let anyDownloadable = false;
        for (const e of Object.values(compilation.entities)) {
          const resolvedEntity = await resolveEntity(e, 0);
          if (!resolvedEntity) continue;
          if (resolvedEntity.options?.allowDownload) {
            anyDownloadable = true;
          }
          for (const mediaType of resolvedEntity.__mediaTypes ?? []) {
            mediaTypesSet.add(mediaType);
          }
          for (const license of resolvedEntity.__licenses || []) {
            licencesSet.add(license);
          }
        }

        await compilationCollection.updateOne(
          { _id: new ObjectId(compilation._id) },
          {
            $set: {
              __licenses: Array.from(licencesSet),
              __mediaTypes: Array.from(mediaTypesSet),
              __downloadable: anyDownloadable,
            },
          },
        );
      }
    });

    return entity;
  },
});
