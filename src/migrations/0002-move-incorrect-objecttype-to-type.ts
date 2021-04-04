import { Mongo, updateOne } from '../services/mongo';
import { Configuration } from '../services/configuration';
import { IEntity, IDigitalEntity } from '../common/interfaces';

(async () => {
  const client = await Mongo.init();
  if (!client) return;
  const db = client.db(Configuration.Mongo.RepositoryDB);
  const entities = db.collection<IEntity>('entity');
  const digitalEntities = db.collection<IDigitalEntity>('digitalentity');

  const types = ['model', 'audio', 'image', 'video'];

  const entityCursor = entities.find({});
  while (await entityCursor.hasNext()) {
    const entity = await entityCursor.next();
    if (!entity) continue;
    if (!entity.relatedDigitalEntity._id) continue;
    const digitalEntity = await digitalEntities.findOne(
      Mongo.query(entity.relatedDigitalEntity._id),
    );
    if (!digitalEntity) continue;

    const { objecttype, type, title } = digitalEntity;
    const { mediaType } = entity;

    const needsMigration = types.includes(objecttype) || type === '';
    if (!needsMigration) continue;
    console.log(`Migrating digital Entity ${title}`);

    const result = await updateOne(
      Mongo.getEntitiesRepository().collection<IDigitalEntity>('digitalentity'),
      Mongo.query(digitalEntity._id),
      {
        $set: {
          // Set type to mediaType from parent entity
          type: mediaType,
          // Clear objecttype if it erroneously contains a mediaType
          objecttype: types.includes(objecttype) ? '' : objecttype,
        },
      },
    ).catch(console.log);
    console.log(result ? result.result.ok === 1 : `Failed saving digital Entity ${title}`);
  }

  process.exit(0);
})();
