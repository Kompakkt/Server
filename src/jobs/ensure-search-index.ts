import { Collection } from '@kompakkt/common';
import { err, log } from 'src/logger';
import { compilationCollection, entityCollection } from 'src/mongo';
import {
  RESOLVE_FULL_DEPTH,
  resolveCompilation,
  resolveEntity,
} from 'src/routers/modules/api.v1/resolving-strategies';
import { searchService } from 'src/sonic';

export const SearchIndexJobState = new (class {
  #state: 'idle' | 'running' | 'done' = 'idle';
  public get state() {
    return this.#state;
  }
  public get isDone() {
    return this.#state === 'done';
  }

  async #buildPromise() {
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
  }

  public async buildSearchIndex() {
    this.#state = 'running';
    const hasExistingData = await searchService.hasExistingData();
    if (hasExistingData) {
      log('Existing search index data found, updating index');
      this.#buildPromise()
        .catch(error => {
          err(`Failed building search index: ${error}`);
        })
        .finally(() => {
          this.#state = 'done';
        });
    } else {
      log('No existing search index data found, building from scratch');
      await this.#buildPromise()
        .catch(error => {
          err(`Failed building search index from scratch: ${error}`);
        })
        .finally(() => {
          this.#state = 'done';
        });
    }
    return Promise.resolve();
  }
})();

export const ensureSearchIndex = async () => {
  return SearchIndexJobState.buildSearchIndex();
};
