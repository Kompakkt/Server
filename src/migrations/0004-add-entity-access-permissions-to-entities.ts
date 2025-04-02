import { Repo, Accounts, query, stripUserData } from '../services/db';
import { IDocument, IStrippedUserData } from 'src/common';

(async () => {
  const entities = await Repo.entity.find({}).catch(e => {
    console.error(e);
    process.exit(1);
  });
  const users = await Accounts.users.find({}).catch(e => {
    console.error(e);
    process.exit(1);
  });
  if (!users || !entities) {
    console.error('No users or entities found');
    process.exit(1);
  }

  for (const entity of entities) {
    const entityId = entity._id.toString();

    const needsMigration =
      entity['access'] === undefined || Object.keys(entity['access']).length === 0;
    if (!needsMigration) {
      continue;
    }
    console.log(`Migrating entity ${entityId}`);

    const owners = users
      .filter(user => {
        const arr: Array<string | IDocument | null> = user?.data?.entity ?? [];
        const ownerIds = arr
          .filter((id): id is string | IDocument => !!id)
          .map(id => (typeof id === 'string' ? id : id._id.toString()));
        return ownerIds.includes(entityId);
      })
      .map(user => stripUserData(user));

    const access: Record<string, IStrippedUserData & { role: 'owner' | 'editor' | 'viewer' }> = {};

    const creatorIsOwner =
      !!entity.creator &&
      owners.some(owner => owner._id.toString() === entity.creator?._id?.toString());
    for (const owner of owners) {
      if (owner._id.toString() === entity.creator?._id?.toString()) continue;
      access[owner._id.toString()] = { ...stripUserData(owner), role: 'owner' };
    }
    if (creatorIsOwner && !!entity.creator?._id) {
      access[entity.creator!._id.toString()] = { ...stripUserData(entity.creator!), role: 'owner' };
    }

    if (Object.keys(access).length === 0) {
      console.log('Failed to determine owner', entity._id, entity?.creator, owners);
      continue;
    }

    console.log('Updating entity...');
    const result = await Repo.entity.updateOne(query(entityId), { $set: { access } });
    console.log('Modified?:', result?.modifiedCount);

    const entityAfterMigration = await Repo.entity.findOne(query(entityId));
    console.log('Entity after migration:', entityAfterMigration);
  }

  process.exit(0);
})();
