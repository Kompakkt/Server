import { Repo, query } from '../services/db';

(async () => {
  const entities = await Repo.entity.findAll().catch(e => {
    console.error(e);
    process.exit(1);
  });
  for (const entity of entities) {
    if (!entity) continue;
    const { settings, name } = entity;

    const needsMigration = !!entity.settings.preview.match(/^http(s)?:\/\//);
    if (!needsMigration) continue;

    const tmp = settings.preview.replace(/^http(s)?:\/\//, '');
    const fixed = tmp.substr(tmp.indexOf('/') + 1);

    console.log(`Migrating Entity ${name}`);
    console.log(fixed);

    settings.preview = fixed;

    const result = await Repo.entity
      .updateOne(query(entity._id), {
        $set: { settings },
      })
      .catch(console.log);
    console.log(result ? result : `Failed saving Entity ${name}`);
  }

  process.exit(0);
})();
