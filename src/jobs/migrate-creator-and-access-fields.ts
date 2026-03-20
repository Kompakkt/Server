import { FindCursor, ObjectId, type UpdateFilter, Collection as MongoCollection } from 'mongodb';
import { Collection, EntityAccessRole, ProfileType } from '@kompakkt/common';
import type {
  AccessFieldEntry,
  CreatorField,
  ICompilation,
  IEntity,
  IStrippedUserData,
  IUserData,
} from '@kompakkt/common/interfaces';
import { warn } from 'src/logger';
import {
  collectionMap,
  compilationCollection,
  entityCollection,
  migrationCollection,
  Migrations,
  userCollection,
} from 'src/mongo';
import type { ServerDocument } from 'src/util/document-with-objectid-type';

const findValidCreator = (
  element: ServerDocument<IEntity> | ServerDocument<ICompilation>,
): IStrippedUserData | undefined => {
  if (element.creator) return element.creator;
  else {
    if (Array.isArray(element.access)) {
      return element.access.find(entry => entry.role === EntityAccessRole.owner);
    } else {
      return Object.values(
        (element as unknown as { access: Record<string, AccessFieldEntry> }).access,
      ).find(entry => entry.role === EntityAccessRole.owner);
    }
  }
};

const memoizedUsers = new Map<string, ServerDocument<IUserData>>();

const migrateCollection = async (
  collection:
    | MongoCollection<ServerDocument<IEntity>>
    | MongoCollection<ServerDocument<ICompilation>>,
) => {
  let skippedCount = 0;
  const cursor = collection.find();
  for await (const entity of cursor) {
    // Sanity checks
    if (!entity.creator && !entity.access) {
      warn(
        `Document ${entity._id} is missing both creator and access fields, skipping migration for this document.`,
      );
      skippedCount++;
      continue;
    }

    const firstValidCreator = findValidCreator(entity);
    if (!firstValidCreator) {
      warn(
        `Could not find valid creator for document ${entity._id}, skipping migration for this document.`,
      );
      skippedCount++;
      continue;
    }

    const relatedUser =
      memoizedUsers.get(firstValidCreator._id) ??
      (await userCollection.findOne({ _id: new ObjectId(firstValidCreator._id) }));
    if (!relatedUser) {
      warn(
        `Could not find user with ID ${firstValidCreator._id} for entity ${entity._id}, skipping migration for this document.`,
      );
      skippedCount++;
      continue;
    }
    memoizedUsers.set(firstValidCreator._id, relatedUser);
    const userProfile = relatedUser.profiles.find(profile => profile.type === ProfileType.user);
    if (!userProfile) {
      warn(
        `User with ID ${firstValidCreator._id} does not have a user profile for document ${entity._id}, skipping migration for this document.`,
      );
      skippedCount++;
      continue;
    }

    // Migration
    if (!entity.creator || !entity.creator?.profile?.profileId) {
      // Create fresh creator entry based on user data
      entity.creator = {
        _id: relatedUser._id.toString(),
        username: relatedUser.username,
        fullname: relatedUser.fullname,
        profile: userProfile,
      };
    }

    if (!entity.access) {
      // Create fresh access field with owner entry based on user data
      entity.access = [{ ...entity.creator, role: EntityAccessRole.owner }];
    } else {
      // If access field already exists, we need to check if its in the old object format
      if (!Array.isArray(entity.access)) {
        entity.access = Object.values(
          (entity as unknown as { access: Record<string, AccessFieldEntry> }).access,
        );
      }
    }

    for (let i = 0; i < entity.access.length; i++) {
      const accessEntry = entity.access[i];
      if (!accessEntry.profile || !accessEntry.profile.profileId) {
        // Fill in missing profile data
        const entryUser =
          memoizedUsers.get(accessEntry._id) ??
          (await userCollection.findOne({ _id: new ObjectId(accessEntry._id) }));
        if (!entryUser) {
          warn(
            `Could not find user with ID ${accessEntry._id} for access entry in entity ${entity._id}, skipping this access entry.`,
          );
          continue;
        }
        memoizedUsers.set(accessEntry._id, entryUser);
        const entryUserProfile = entryUser.profiles.find(
          profile => profile.type === ProfileType.user,
        );
        if (!entryUserProfile) {
          warn(
            `User with ID ${accessEntry._id} does not have a user profile for access entry in document ${entity._id}, skipping this access entry.`,
          );
          continue;
        }
        entity.access[i].username = entryUser.username;
        entity.access[i].fullname = entryUser.fullname;
        entity.access[i].profile = entryUserProfile;
      }
    }

    const result = await collection
      .updateOne(
        { _id: new ObjectId(entity._id) },
        { $set: { creator: entity.creator, access: entity.access } },
      )
      .catch(err => {
        warn(`Failed to update document ${entity._id} during migration:`, err);
      });

    if (!result || result.modifiedCount === 0) {
      warn(`No modifications made to entity ${entity._id} during migration.`);
      skippedCount++;
    }
  }

  return skippedCount;
};

export const migrateCreatorAndAccessFields = async () => {
  /*const result = await migrationCollection.findOne({
    name: Migrations.migrateCreatorAndAccessFields,
  });
  if (result) return;*/

  const results = await Promise.allSettled([
    migrateCollection(entityCollection),
    migrateCollection(compilationCollection),
  ]);

  if (!results.every(result => result.status === 'fulfilled')) {
    return;
  }

  const [entityResult, compilationResult] = results as PromiseFulfilledResult<number>[];
  const totalSkipped = entityResult.value + compilationResult.value;
  if (totalSkipped > 0) {
    warn(`Migration completed with ${totalSkipped} documents skipped due to missing data.`);
    return;
  } else {
    console.log('Migration completed successfully with no skipped documents.');
  }

  await migrationCollection.insertOne({
    name: Migrations.migrateCreatorAndAccessFields,
    completedAt: Date.now(),
  });
};
