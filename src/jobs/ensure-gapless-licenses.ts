import { log } from 'src/logger';
import { digitalEntityCollection } from 'src/mongo';

export const ensureGaplessLicenses = async () => {
  const entities = await digitalEntityCollection
    .find({ licence: { $regex: new RegExp(/\-/gi) } })
    .toArray();
  if (entities.length === 0) return;
  log(`Found ${entities.length} entities with non-gapless licenses, updating...`);
  for (const entity of entities) {
    if (!entity.licence) continue;
    const gapless = entity.licence.replaceAll('-', '');
    await digitalEntityCollection.updateOne({ _id: entity._id }, { $set: { licence: gapless } });
  }
};
