import { log } from 'src/logger';
import { userCollection, migrationCollection, Migrations } from 'src/mongo';

export const migrateUserFlags = async () => {
  const migrated = await migrationCollection.findOne({
    name: Migrations.migrateUserFlags,
  });
  if (migrated) {
    log('User flags migration already completed, skipping.');
    return;
  }

  const usersWithoutFlags = await userCollection.find({ flags: { $exists: false } }).toArray();

  if (usersWithoutFlags.length === 0) {
    log('All users already have flags property, skipping migration.');
    await migrationCollection.insertOne({
      name: Migrations.migrateUserFlags,
      completedAt: Date.now(),
    });
    return;
  }

  log(
    `Found ${usersWithoutFlags.length} users without flags property, adding empty flags array...`,
  );

  for (const user of usersWithoutFlags) {
    await userCollection.updateOne({ _id: user._id }, { $set: { flags: [] } });
  }

  await migrationCollection.insertOne({
    name: Migrations.migrateUserFlags,
    completedAt: Date.now(),
  });

  log(`User flags migration completed. Updated ${usersWithoutFlags.length} users.`);
};
