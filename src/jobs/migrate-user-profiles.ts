import { ProfileType } from '@kompakkt/common';
import { info } from 'src/logger';
import { Migrations, migrationCollection, userCollection } from 'src/mongo';

export const migrateUserProfiles = async () => {
  const migrated = await migrationCollection.findOne({ name: Migrations.migrateUserProfiles });
  if (migrated) {
    info('Skipping migrateUserProfiles, migration record already present');
    return;
  }

  // Find users where 'profiles' exists and is an object (not an array or undefined)
  const userCursor = userCollection.find({
    profiles: { $exists: true, $type: 'object' },
  });

  let migratedCount = 0;
  for await (const user of userCursor) {
    if (Array.isArray(user.profiles)) {
      continue;
    }

    const newProfiles = Object.entries(
      user.profiles as unknown as { [key: string]: ProfileType },
    ).map(([profileId, type]) => ({ profileId, type }));
    console.log(user, newProfiles);

    await userCollection.updateOne({ _id: user._id }, { $set: { profiles: newProfiles } });

    console.log(`Migrated profiles for user: ${user.username} (${newProfiles.length} profiles)`);
    migratedCount++;
  }

  console.log(`Migration complete. Total users migrated: ${migratedCount}`);

  await migrationCollection.insertOne({
    name: Migrations.migrateUserProfiles,
    completedAt: Date.now(),
  });
};
