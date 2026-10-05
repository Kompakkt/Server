import { ObjectId } from 'mongodb';
import { ProfileType } from '@kompakkt/common';
import { info } from 'src/logger';
import { Migrations, migrationCollection, profileCollection, userCollection } from 'src/mongo';
import { createNewUserProfile } from 'src/util/create-new-user-profile';

export const ensureDefaultUserProfile = async () => {
  const migrated = await migrationCollection.findOne({
    name: Migrations.ensureDefaultUserProfile,
  });
  if (migrated) {
    info('Skipping ensureDefaultUserProfile, migration record already present');
    return;
  }

  const userCursor = userCollection.find({
    // No profiles field at all or profiles array exists but has no element with type 'user'
    $or: [
      { profiles: { $exists: false } },
      { profiles: { $not: { $elemMatch: { type: ProfileType.user } } } },
    ],
  });
  for await (const user of userCursor) {
    user.profiles ??= [];
    const hasUserProfile = user.profiles.some(p => p.type === ProfileType.user);
    if (hasUserProfile) continue;

    const result = await createNewUserProfile(user).catch(err => {
      console.error(`Error creating profile for user ${user.username}:`, err);
      return null;
    });
    if (!result) {
      continue;
    }

    user.profiles.push(result);

    await userCollection.updateOne({ _id: user._id }, { $set: { profiles: user.profiles } });
  }

  await migrationCollection.insertOne({
    name: Migrations.ensureDefaultUserProfile,
    completedAt: Date.now(),
  });
};
