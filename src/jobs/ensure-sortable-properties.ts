import { ObjectId } from 'mongodb';
import { log } from 'src/logger';
import { compilationCollection, entityCollection, profileCollection } from 'src/mongo';

/**
 * Ensures existence of all ISortable properties on explore-able documents.
 */
export const ensureSortableProperties = async () => {
  const collections = [entityCollection, compilationCollection, profileCollection];
  for (const collection of collections) {
    const entities = await collection
      .find({
        $or: [
          { __createdAt: { $exists: false } },
          { __hits: { $exists: false } },
          { __annotationCount: { $exists: false } },
          { __normalizedName: { $exists: false } },
        ],
      })
      .toArray();
    if (entities.length === 0) continue;
    log(
      `Found ${entities.length} entities in ${collection.collectionName} without sortable properties...`,
    );
    for (const entity of entities) {
      if (!entity.__createdAt) {
        // Parse ObjectId timestamp to number
        entity.__createdAt = new ObjectId(entity._id).getTimestamp().getTime();
      }
      if (!entity.__hits) {
        entity.__hits = 0;
      }
      if (!entity.__annotationCount) {
        if ('annotations' in entity) {
          entity.__annotationCount = Object.keys(entity.annotations || {}).length;
        } else {
          entity.__annotationCount = 0;
        }
      }
      if (!entity.__normalizedName) {
        if ('name' in entity) {
          entity.__normalizedName = entity.name.trim().toLowerCase();
        } else if ('displayName' in entity) {
          entity.__normalizedName = entity.displayName?.trim().toLowerCase() ?? '';
        }
      }
      await entityCollection.updateOne(
        { _id: entity._id },
        {
          $set: {
            __createdAt: entity.__createdAt,
            __hits: entity.__hits,
            __annotationCount: entity.__annotationCount,
            __normalizedName: entity.__normalizedName,
          },
        },
      );
    }
  }
};
