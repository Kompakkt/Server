import { ProfileMemberRole, ProfileType, type Collection } from '@kompakkt/common';
import { info } from 'src/logger';
import { Migrations, migrationCollection, profileCollection, userCollection } from 'src/mongo';
import { searchService } from 'src/sonic';

export const backfillProfileOwnerId = async () => {
  const migrated = await migrationCollection.findOne({ name: Migrations.backfillProfileOwnerId });
  if (migrated) {
    info('Skipping backfillProfileOwnerId, migration record already present');
    return;
  }

  const profileCursor = profileCollection.find({
    type: ProfileType.organization,
    ownerId: { $exists: false },
  });

  let backfilledCount = 0;
  for await (const profile of profileCursor) {
    const profileId = profile._id.toString();
    const ownerUser = await userCollection.findOne({ 'profiles.profileId': profileId });
    if (!ownerUser) {
      info(`No parent user found for organization profile ${profileId}, skipping`);
      continue;
    }

    await profileCollection.updateOne(
      { _id: profile._id },
      { $set: { ownerId: ownerUser._id.toString(), members: [] } },
    );

    searchService.updateDocument(
      'profile' as Collection,
      {
        ...profile,
        ownerId: ownerUser._id.toString(),
        members: [],
      } as Parameters<typeof searchService.updateDocument>[1],
    );

    await userCollection.updateOne(
      { '_id': ownerUser._id, 'profiles.profileId': profileId },
      { $set: { 'profiles.$.role': ProfileMemberRole.owner } },
    );

    backfilledCount++;
  }

  const roleResult = await userCollection.updateMany(
    { 'profiles.type': ProfileType.user, 'profiles.role': { $exists: false } },
    { $set: { 'profiles.$[profile].role': ProfileMemberRole.owner } },
    { arrayFilters: [{ 'profile.type': ProfileType.user, 'profile.role': { $exists: false } }] },
  );
  info(
    `Stamped owner role on ${roleResult.modifiedCount} personal profile reference(s) missing a role`,
  );

  info(`Backfilled ownerId on ${backfilledCount} organization profile(s)`);

  await migrationCollection.insertOne({
    name: Migrations.backfillProfileOwnerId,
    completedAt: Date.now(),
  });
};
