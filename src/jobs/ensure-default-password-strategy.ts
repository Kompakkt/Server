import { userCollection } from 'src/mongo';

export const ensureDefaultPasswordStrategy = async () => {
  await userCollection
    .updateMany({ strategy: { $exists: false } }, { $set: { strategy: 'local' } })
    .catch(err => {
      console.error('Error updating user strategies:', err);
    });
};
