import type { IPublicProfile, IUserData } from '@kompakkt/common';
import { ProfileType } from '@kompakkt/common';
import type { Filter } from 'mongodb';
import { info } from 'src/logger';
import { profileCollection, userCollection } from 'src/mongo';
import type { ServerDocument } from 'src/util/document-with-objectid-type';

const INSTITUTION = 'institution' as const;

export const migrateInstitutionProfiles = async () => {
  const profileFilter = { type: INSTITUTION } as unknown as Filter<ServerDocument<IPublicProfile>>;
  const profileResult = await profileCollection.updateMany(profileFilter, {
    $set: { type: ProfileType.organization },
  });
  info(
    `Migrated ${profileResult.modifiedCount} profile document(s) from '${INSTITUTION}' to '${ProfileType.organization}'`,
  );

  const userFilter = {
    'profiles.type': INSTITUTION,
  } as unknown as Filter<ServerDocument<IUserData>>;
  const userResult = await userCollection.updateMany(
    userFilter,
    { $set: { 'profiles.$[profile].type': ProfileType.organization } },
    { arrayFilters: [{ 'profile.type': INSTITUTION }] },
  );
  info(
    `Migrated ${userResult.modifiedCount} user profile reference(s) from '${INSTITUTION}' to '${ProfileType.organization}'`,
  );
};
