import { ObjectId } from 'mongodb';
import { ProfileType } from 'src/common';
import { warn } from 'src/logger';
import { entityCollection, userCollection } from 'src/mongo';

export const ensureEntityCreatorIsProfile = async () => {
  const cursor = entityCollection.find({
    'creator.fullname': { $ne: null },
    'creator.username': { $ne: null },
    'creator.profile': { $exists: false },
  });
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
            _id: profileId,
            type: ProfileType.user,
          },
        },
      },
    );
  }
};
