import { ProfileType } from '@kompakkt/common';
import { info } from 'src/logger';
import { Migrations, migrationCollection, profileCollection } from 'src/mongo';
import { indexProfile } from 'src/util/profile-index';

/**
 * Index existing personal profiles in Sonic.
 *
 * Organizational profiles are already indexed (on create/update and by
 * `backfill-profile-owner-id`); personal profiles were not indexed until
 * profile search started covering them.
 */
export const indexPersonalProfiles = async () => {
  const migrated = await migrationCollection.findOne({ name: Migrations.indexPersonalProfiles });
  if (migrated) {
    info('Skipping indexPersonalProfiles, migration record already present');
    return;
  }

  const personalProfiles = await profileCollection.find({ type: ProfileType.user }).toArray();
  for (const profile of personalProfiles) {
    indexProfile(profile);
  }

  info(`Indexed ${personalProfiles.length} personal profile(s)`);

  await migrationCollection.insertOne({
    name: Migrations.indexPersonalProfiles,
    completedAt: Date.now(),
  });
};
