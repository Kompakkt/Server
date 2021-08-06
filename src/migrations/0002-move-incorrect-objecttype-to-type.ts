import '../services/db/client';
import { Repo } from '../services/db/controllers';
import { query } from '../services/db/functions';

(async () => {
  const types = ['model', 'audio', 'image', 'video'];

  const entityCursor = Repo.entity.findAllCursor();
  while (await entityCursor.hasNext()) {
    const entity = await entityCursor.next();
    if (!entity) continue;
    if (!entity.relatedDigitalEntity._id) continue;
    const digitalEntity = await Repo.digitalentity.findOne(query(entity.relatedDigitalEntity._id));
    if (!digitalEntity) continue;

    const { objecttype, type, title } = digitalEntity;
    const { mediaType } = entity;

    const needsMigration = types.includes(objecttype) || type === '';
    if (!needsMigration) continue;
    console.log(`Migrating digital Entity ${title}`);

    const result = await Repo.digitalentity
      .updateOne(query(digitalEntity._id), {
        $set: {
          // Set type to mediaType from parent entity
          type: mediaType,
          // Clear objecttype if it erroneously contains a mediaType
          objecttype: types.includes(objecttype) ? '' : objecttype,
        },
      })
      .catch(console.log);
    console.log(result ? result : `Failed saving digital Entity ${title}`);
  }

  process.exit(0);
})();
