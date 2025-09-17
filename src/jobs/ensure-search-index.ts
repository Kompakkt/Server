import { Collection } from 'src/common';
import { err, log } from 'src/logger';
import { compilationCollection, entityCollection } from 'src/mongo';
import {
  RESOLVE_FULL_DEPTH,
  resolveCompilation,
  resolveEntity,
} from 'src/routers/modules/api.v1/resolving-strategies';
import { searchService } from 'src/sonic';

const buildSearchIndex = async () => {
  const entityCursor = entityCollection.find({ finished: true, online: true });
  let startTime = performance.now();
  for await (const entity of entityCursor) {
    await resolveEntity(entity, RESOLVE_FULL_DEPTH).then(resolved =>
      resolved ? searchService.updateDocument(Collection.entity, resolved) : undefined,
    );
  }
  const entitiesDuration = ((performance.now() - startTime) / 1000).toFixed(2);

  const compilationCursor = compilationCollection.find({});
  startTime = performance.now();
  for await (const compilation of compilationCursor) {
    await resolveCompilation(compilation, RESOLVE_FULL_DEPTH).then(resolved =>
      resolved ? searchService.updateDocument(Collection.compilation, resolved) : undefined,
    );
  }
  const compilationsDuration = ((performance.now() - startTime) / 1000).toFixed(2);

  log(
    `Updated search index, entities took ${entitiesDuration}s, compilations took ${compilationsDuration}s`,
  );
};

export const ensureSearchIndex = async () => {
  const hasExistingData = await searchService.hasExistingData();

  if (hasExistingData) {
    log('Existing search index data found, updating index');
    buildSearchIndex().catch(error => {
      err(`Failed building search index: ${error}`);
    });
    return;
  }

  log('No existing search index data found, building from scratch');
  await buildSearchIndex().catch(error => {
    err(`Failed building search index from scratch: ${error}`);
  });
};
