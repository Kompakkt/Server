import { ObjectId } from 'mongodb';
import { log, warn } from 'src/logger';
import {
  annotationCollection,
  compilationCollection,
  digitalEntityCollection,
  entityCollection,
} from 'src/mongo';

/**
 * Ensures existence of __updatedAt on the documents that carry it, seeding any
 * missing value from the ObjectId creation timestamp. Idempotent.
 */
export const ensureUpdatedAt = async () => {
  const collections = [
    entityCollection,
    compilationCollection,
    digitalEntityCollection,
    annotationCollection,
  ];
  for (const collection of collections) {
    const documents = await collection.find({ __updatedAt: { $exists: false } }).toArray();
    if (documents.length === 0) continue;
    log(
      `Found ${documents.length} documents in ${collection.collectionName} without __updatedAt...`,
    );
    for (const document of documents) {
      try {
        await collection.updateOne(
          { _id: document._id },
          { $set: { __updatedAt: new ObjectId(document._id).getTimestamp().getTime() } },
        );
      } catch (err) {
        warn(
          `Error updating ${document._id.toString()} in collection ${collection.collectionName}: ${err}`,
        );
      }
    }
  }
};
