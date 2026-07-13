import { ObjectId } from 'mongodb';
import { Collection, type ICompilation, type IEntity } from '@kompakkt/common';
import { err, log } from 'src/logger';
import { compilationCollection, entityCollection, profileCollection } from 'src/mongo';
import { HookManager } from 'src/routers/modules/api.v1/hooks';
import {
  resolveDigitalEntity,
  resolveEntity,
} from 'src/routers/modules/api.v1/resolving-strategies';
import type { ServerDocument } from 'src/util/document-with-objectid-type';

/**
 * Recompute and persist the filterable properties (`__licenses`, `__mediaTypes`,
 * `__downloadable`) for a single compilation from its contained entities.
 * Returns the computed values without writing them, so callers can decide what
 * to do with them.
 *
 * Used in the `afterSave` hook for compilations and entities.
 */
const recomputeCompilationFilterables = async (compilation: {
  entities: Record<string, unknown>;
}): Promise<{ __licenses: string[]; __mediaTypes: string[]; __downloadable: boolean }> => {
  const licencesSet = new Set<string>();
  const mediaTypesSet = new Set<string>();
  let anyDownloadable = false;
  for (const e of Object.values(compilation.entities)) {
    if (typeof e !== 'object' || e === null) continue;
    const resolved = await resolveEntity(e as never, 0);
    if (!resolved) continue;
    if (resolved.options?.allowDownload) anyDownloadable = true;
    for (const mediaType of resolved.__mediaTypes ?? []) mediaTypesSet.add(mediaType);
    for (const license of resolved.__licenses ?? []) licencesSet.add(license);
  }
  return {
    __licenses: Array.from(licencesSet),
    __mediaTypes: Array.from(mediaTypesSet),
    __downloadable: anyDownloadable,
  };
};

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
          // `$exists: false` only matches absent fields; in MongoDB a field
          // explicitly set to `null` is considered present, so we additionally
          // match `null` (BSON type 10) and empty arrays to repair those too.
          { __licenses: { $exists: false } },
          { __licenses: { $type: 'null' } },
          { __licenses: { $size: 0 } },
          { __mediaTypes: { $exists: false } },
          { __mediaTypes: { $type: 'null' } },
          { __mediaTypes: { $size: 0 } },
          { __downloadable: { $exists: false } },
          { __downloadable: { $type: 'null' } },
        ],
      })
      .toArray();
    if (entities.length === 0) continue;
    log(
      `Found ${entities.length} entities in ${collection.collectionName} without filterable properties...`,
    );
    for (const entity of entities) {
      if (!entity.__licenses || entity.__licenses.length === 0) {
        // For entities, we need to extract from relatedDigitalEntity
        if ('relatedDigitalEntity' in entity) {
          const digitalEntity = await resolveDigitalEntity(entity.relatedDigitalEntity, 0);
          if (digitalEntity && 'licence' in digitalEntity && digitalEntity.licence) {
            entity.__licenses = [digitalEntity.licence];
          } else {
            entity.__licenses = [];
          }
        }
        // For compilations, we need to extract from all related entities
        else if ('entities' in entity) {
          const licencesSet = new Set<string>();
          for (const e of Object.values(entity.entities)) {
            if (typeof e === 'object' && e !== null && 'relatedDigitalEntity' in e) {
              const digitalEntity = await resolveDigitalEntity(e.relatedDigitalEntity, 0);
              if (digitalEntity && 'licence' in digitalEntity && digitalEntity.licence) {
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

      if (!entity.__mediaTypes || entity.__mediaTypes.length === 0) {
        // For entities, we can extract directly
        if ('relatedDigitalEntity' in entity) {
          entity.__mediaTypes = entity.mediaType ? [entity.mediaType] : [];
        } else if ('entities' in entity) {
          // For compilations, we need to extract from all related entities
          const mediaTypesSet = new Set<string>();
          for (const e of Object.values(entity.entities)) {
            if (typeof e === 'object' && e !== null) {
              const resolved = await resolveEntity(e, 0);
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
              const resolved = await resolveEntity(e, 0);
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

      await collection.updateOne(
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
    queueMicrotask(() => {
      log(
        `Entity ${entity._id.toString()} has changed filterable properties, updating compilations...`,
      );

      (async () => {
        // Update compilations containing this entity
        const compilations = await compilationCollection
          .find({ [`entities.${entity._id.toString()}`]: { $exists: true } })
          .toArray();
        for (const compilation of compilations) {
          // Recalculate compilation properties
          const { __licenses, __mediaTypes, __downloadable } =
            await recomputeCompilationFilterables(compilation);

          await compilationCollection.updateOne(
            { _id: new ObjectId(compilation._id) },
            {
              $set: {
                __licenses,
                __mediaTypes,
                __downloadable,
              },
            },
          );
        }
      })().catch(error => {
        err(`Failed to update compilations after entity ${entity._id.toString()} save:`, error);
      });
    });

    return entity;
  },
});

HookManager.addHook({
  collection: Collection.compilation,
  type: 'afterSave',
  callback: async (compilation: ServerDocument<ICompilation>, userdata) => {
    if (!userdata) return compilation;

    // NOTE: This updates compilations no matter whether anything relevant for them changed.
    // We don't need to wait for the hooks execution as they are just used for filtering
    queueMicrotask(() => {
      log(`Compilation ${compilation._id.toString()} saved, recomputing filterable properties...`);

      (async () => {
        const { __licenses, __mediaTypes, __downloadable } =
          await recomputeCompilationFilterables(compilation);

        await compilationCollection.updateOne(
          { _id: new ObjectId(compilation._id) },
          {
            $set: {
              __licenses,
              __mediaTypes,
              __downloadable,
            },
          },
        );
      })().catch(error => {
        err(
          `Failed to recompute filterable properties for compilation ${compilation._id.toString()}:`,
          error,
        );
      });
    });

    return compilation;
  },
});
