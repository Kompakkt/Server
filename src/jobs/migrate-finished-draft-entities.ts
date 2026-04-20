import {
  digitalEntityCollection,
  entityCollection,
  migrationCollection,
  Migrations,
  userCollection,
} from 'src/mongo';
import { ObjectId } from 'mongodb';
import { Collection, isDigitalEntity, isEntity } from '@kompakkt/common';
import { saveHandler } from 'src/routers/modules/api.v1/save-to-collection';

/**
 * This migration handles a bugged case, where some entities have been uploaded as draft, edited later, but were never marked as "finished".
 * This resulted in entities with incorrect "name" field values on the entities, while the digital entity itself has correct metadata.
 */
export const migrateFinishedDraftEntities = async () => {
  const result = await migrationCollection.findOne({
    name: Migrations.migrateFinishedDraftEntities,
  });
  if (result) return;

  const updatedList = new Array<string>();
  try {
    const cursor = entityCollection.aggregate([
      {
        $addFields: {
          digitalEntityId: { $toObjectId: '$relatedDigitalEntity._id' },
        },
      },
      {
        $lookup: {
          from: digitalEntityCollection.collectionName,
          localField: 'digitalEntityId',
          foreignField: '_id',
          as: 'digitalEntityDoc',
        },
      },
      {
        $unwind: '$digitalEntityDoc',
      },
    ]);
    for await (const entity of cursor) {
      const digitalEntity = entity.digitalEntityDoc;
      if (!isDigitalEntity(digitalEntity)) continue;
      if (!isEntity(entity)) continue;
      // If the entity has the same name, it is likely that it was not affected by the bug
      if (entity.name === digitalEntity.title) continue;

      const updatedEntity = {
        ...entity,
        name: digitalEntity.title.trim(),
        finished: true,
      };

      // Remove the fields added for the lookup
      delete (updatedEntity as any).digitalEntityDoc;
      delete (updatedEntity as any).digitalEntityId;

      const userdata = await userCollection.findOne({
        _id: new ObjectId(entity.creator._id),
      });
      if (!userdata) {
        throw new Error(`User with _id: ${entity.creator._id} not found`);
      }

      const success = await saveHandler({
        collection: Collection.entity,
        body: updatedEntity,
        userdata,
      });

      if (!success) {
        throw new Error(`Failed to update entity with _id: ${entity._id}`);
      }
      updatedList.push(entity._id.toString());
    }

    await migrationCollection.insertOne({
      name: Migrations.migrateFinishedDraftEntities,
      completedAt: Date.now(),
    });

    console.log(
      `Migration of finished draft entities completed. Updated ${updatedList.length} entities.`,
      updatedList.join(', '),
    );
  } catch (err) {
    console.error('Error during migration of finished draft entities:', err);
  }
};
