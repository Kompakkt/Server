import { log } from 'src/logger';
import { entityCollection } from 'src/mongo';

export const ensureEntitySettingsScaleAsVector = async () => {
  const updateResult = await entityCollection.updateMany(
    { 'settings.scale': { $type: 'number' } },
    [
      {
        $set: {
          'settings.scale': {
            x: '$settings.scale',
            y: '$settings.scale',
            z: '$settings.scale',
          },
        },
      },
    ],
  );

  if (updateResult.modifiedCount > 0) {
    log(`Updated ${updateResult.modifiedCount} entities to ensure scale is a vector.`);
    if (updateResult.acknowledged) {
      log('Scale update operation was acknowledged by the database.');
    } else {
      log('Scale update operation was NOT acknowledged by the database.');
    }
  } else {
    log('No entities required scale update.');
  }
};
