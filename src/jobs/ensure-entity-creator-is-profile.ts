import { ObjectId } from 'mongodb';
import { ProfileType } from '@kompakkt/common';
import { info, warn } from 'src/logger';
import { Migrations, entityCollection, migrationCollection, userCollection } from 'src/mongo';

export const ensureEntityCreatorIsProfile = async () => {
  // Repair legacy docs that got the wrong profile-reference shape written
  // ({_id} instead of {profileId}). Runs before the migration guard so an
  // already-recorded migration cannot freeze the broken shape in place.
  const shapeFix = await entityCollection.updateMany(
    {
      'creator.profile._id': { $exists: true },
      'creator.profile.profileId': { $exists: false },
    },
    [
      {
        $set: {
          'creator.profile': {
            profileId: '$creator.profile._id',
            type: '$creator.profile.type',
          },
        },
      },
    ],
  );
  if (shapeFix.modifiedCount > 0) {
    info(
      `Fixed creator.profile shape (_id -> profileId) on ${shapeFix.modifiedCount} entity document(s)`,
    );
  }

  const migrated = await migrationCollection.findOne({
    name: Migrations.ensureEntityCreatorIsProfile,
  });
  if (migrated) {
    info('Skipping ensureEntityCreatorIsProfile, migration record already present');
    return;
  }

  const cursor = entityCollection.find({
    'creator.fullname': { $ne: null },
    'creator.username': { $ne: null },
    'creator.profile': { $exists: false },
  });
  let stampedCount = 0;
  for await (const entity of cursor) {
    const user = await userCollection.findOne({
      _id: new ObjectId(entity.creator._id),
    });
    if (!user) {
      warn(`User with ID ${entity.creator._id} not found for entity ${entity._id}`);
      continue;
    }
    const profileId = user.profiles.find(p => p.type === ProfileType.user)?.profileId;
    if (!profileId) {
      warn(`No user profile found for user ${user._id} (entity ${entity._id})`);
      continue;
    }
    await entityCollection.updateOne(
      { _id: new ObjectId(entity._id) },
      {
        $set: {
          'creator.profile': {
            profileId,
            type: ProfileType.user,
          },
        },
      },
    );
    stampedCount++;
  }

  info(`Stamped creator.profile on ${stampedCount} entity document(s)`);

  await migrationCollection.insertOne({
    name: Migrations.ensureEntityCreatorIsProfile,
    completedAt: Date.now(),
  });
};
