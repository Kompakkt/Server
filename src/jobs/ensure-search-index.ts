import { Collection } from 'src/common';
import { log } from 'src/logger';
import { compilationCollection, entityCollection } from 'src/mongo';
import { resolveCompilation, resolveEntity } from 'src/routers/modules/api.v1/resolving-strategies';
import { searchService } from 'src/sonic';

export const ensureSearchIndex = async () => {
  const entityCursor = entityCollection.find({ finished: true, online: true });
  let startTime = performance.now();
  for await (const entity of entityCursor) {
    await resolveEntity(entity).then(resolved =>
      resolved ? searchService.updateDocument(Collection.entity, resolved) : undefined,
    );
  }
  const entitiesDuration = ((performance.now() - startTime) / 1000).toFixed(2);

  const compilationCursor = compilationCollection.find({});
  startTime = performance.now();
  for await (const compilation of compilationCursor) {
    await resolveCompilation(compilation).then(resolved =>
      resolved ? searchService.updateDocument(Collection.compilation, resolved) : undefined,
    );
  }
  const compilationsDuration = ((performance.now() - startTime) / 1000).toFixed(2);

  log(
    `Updated search index, entities took ${entitiesDuration}s, compilations took ${compilationsDuration}s`,
  );
};
