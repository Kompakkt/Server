import { Ingest, Search, type Options } from 'sonic-channel';
import { err, log } from './logger';
import { ObjectId } from 'mongodb';
import type { ServerDocument } from './util/document-with-objectid-type';
import {
  Collection,
  isCompilation,
  isDigitalEntity,
  isEntity,
  isInstitution,
  isPerson,
  isPhysicalEntity,
  type ICompilation,
  type IDigitalEntity,
  type IDocument,
  type IEntity,
  type IPerson,
  type IPhysicalEntity,
} from './common';
import { HookManager } from './routers/modules/api.v1/hooks';
import { findParentCompilations, findParentEntities } from './util/cascade-helpers';
import { resolveCompilation, resolveEntity } from './routers/modules/api.v1/resolving-strategies';
import { setImmediate } from 'node:timers';

const options: Options = {
  host: 'sonic',
  port: 1491,
  auth: undefined,
};

const extractText = (value: unknown): string[] => {
  if (value === null || value === undefined) return [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) return [trimmed];
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    return [value.toString()];
  } else if (Array.isArray(value)) {
    return value.flatMap(item => extractText(item));
  } else if (typeof value === 'object') {
    if (Object.prototype.toString.call(value) === '[object Object]') {
      return Object.values(value).flatMap(val => extractText(val));
    }
  }
  return [];
};

const prepareInstitution = (institution?: IDocument | IPhysicalEntity | string) =>
  isInstitution(institution)
    ? {
        name: institution.name,
        university: institution.university,
      }
    : undefined;

const preparePerson = (person?: IDocument | IPerson | string) =>
  isPerson(person)
    ? {
        name: person.prename + ' ' + person.name,
        institutions: Object.values(person.institutions).flatMap(iArr =>
          iArr?.map(prepareInstitution),
        ),
      }
    : undefined;

const prepareMetadataEntity = (
  entity?: IDigitalEntity | IPhysicalEntity | IDocument | string,
): Record<string, any> | undefined => {
  if (!isDigitalEntity(entity) && !isPhysicalEntity(entity)) return undefined;
  return {
    title: entity.title,
    description: entity.description,
    persons: entity.persons.map(preparePerson),
    institutions: entity.institutions.map(prepareInstitution),
    phyObjs: isDigitalEntity(entity) ? entity.phyObjs.map(prepareMetadataEntity) : undefined,
  };
};

const prepareEntity = (entity?: IEntity | IDocument) => {
  if (!isEntity(entity)) return undefined;
  const digitalEntity = isDigitalEntity(entity.relatedDigitalEntity)
    ? entity.relatedDigitalEntity
    : undefined;
  return {
    name: entity.name,
    creator: entity.creator?.fullname,
    digitalEntity: prepareMetadataEntity(digitalEntity),
  };
};

export const buildSearchableText = (data: Record<string, unknown>): string => {
  if (isEntity(data)) {
    return extractText(prepareEntity(data)).join(' ').toLowerCase().trim();
  }

  if (isCompilation(data)) {
    return extractText({
      name: data.name,
      description: data.description,
      creator: data.creator?.fullname,
      entities: Object.values(data.entities).map(prepareEntity),
    })
      .join(' ')
      .toLowerCase()
      .trim();
  }

  return extractText(data).join(' ').toLowerCase().trim();
};

type IndexableDocument = ServerDocument<IEntity | ICompilation>;

class SonicSearchService {
  #searchChannel = new Search(options);
  #ingestChannel = new Ingest(options);

  #queue = new Map<
    string,
    {
      collection: Collection;
      type: 'index' | 'update' | 'delete';
      document: IndexableDocument;
    }
  >([]);

  #isProcessing = false;

  async waitForConnection() {
    const createConnectPromise = (channel: Search | Ingest, channelType: string) => {
      return new Promise<void>((resolve, reject) => {
        channel.connect({
          connected: () => {
            log(`Connected to Sonic ${channelType}`);
            resolve();
          },
          error: error => {
            err(`Error connecting to Sonic ${channelType}: ${error}`);
            reject(error);
          },
        });
      });
    };

    const searchConnectPromise = createConnectPromise(this.#searchChannel, 'Search');
    const ingestConnectPromise = createConnectPromise(this.#ingestChannel, 'Ingest');

    return Promise.all([searchConnectPromise, ingestConnectPromise]);
  }

  async #processQueue() {
    if (this.#isProcessing || this.#queue.size === 0) return;
    this.#isProcessing = true;

    try {
      while (this.#queue.size > 0) {
        const entry = this.#queue.entries().next().value;
        if (!entry) {
          this.#isProcessing = false;
          return;
        }
        const [key, { collection, type, document }] = entry;
        const bucket = key.split('_').at(0) ?? 'default';

        switch (type) {
          case 'index': {
            await this.#indexDocument(collection, document, bucket);
            break;
          }
          case 'update': {
            await this.#updateDocument(collection, document, bucket);
            break;
          }
          case 'delete': {
            await this.#deleteDocument(collection, document, bucket);
            break;
          }
        }

        this.#queue.delete(key);
      }
    } finally {
      this.#isProcessing = false;
    }

    setImmediate(() => {
      this.#processQueue();
    });
  }

  indexDocument<T extends IndexableDocument>(
    collection: Collection,
    document: ServerDocument<T>,
    bucket: string = 'default',
  ) {
    this.#queue.set(`${bucket}_${document._id.toString()}`, {
      collection,
      type: 'index',
      document,
    });
    setImmediate(() => {
      this.#processQueue();
    });
  }

  updateDocument<T extends IndexableDocument>(
    collection: Collection,
    document: ServerDocument<T>,
    bucket: string = 'default',
  ) {
    this.#queue.set(`${bucket}_${document._id.toString()}`, {
      collection,
      type: 'update',
      document,
    });
    setImmediate(() => {
      this.#processQueue();
    });
  }

  deleteDocument<T extends IndexableDocument>(
    collection: Collection,
    document: ServerDocument<T>,
    bucket: string = 'default',
  ) {
    this.#queue.set(`${bucket}_${document._id.toString()}`, {
      collection,
      type: 'delete',
      document,
    });
    setImmediate(() => {
      this.#processQueue();
    });
  }

  async #indexDocument<T>(
    collection: string,
    document: ServerDocument<T>,
    bucket: string = 'default',
  ) {
    const documentId = document._id.toString();
    const searchableText = buildSearchableText(document);
    try {
      await this.#ingestChannel.push(collection, bucket, documentId, searchableText);
    } catch (error) {
      err(`Failed to index document ${documentId} in collection ${collection}:`, error);
      throw error;
    }
  }

  async #updateDocument<T>(
    collection: string,
    document: ServerDocument<T>,
    bucket: string = 'default',
  ) {
    const documentId = document._id.toString();
    const searchableText = buildSearchableText(document);

    try {
      await this.#ingestChannel.flusho(collection, bucket, documentId);
      await this.#ingestChannel.push(collection, bucket, documentId, searchableText);
    } catch (error) {
      err(`Failed to update document ${documentId} in collection ${collection}:`, error);
      throw error;
    }
  }

  async #deleteDocument<T>(
    collection: string,
    document: ServerDocument<T>,
    bucket = 'default',
  ): Promise<void> {
    const documentId = document._id.toString();
    try {
      await this.#ingestChannel.flusho(collection, bucket, documentId);
    } catch (error) {
      err(`Failed to delete document ${documentId} from collection ${collection}:`, error);
      throw error;
    }
  }

  async search(
    collection: string,
    query: string,
    bucket = 'default',
    limit = 100,
  ): Promise<ObjectId[]> {
    limit = Math.min(limit, 100);
    try {
      const sonicResults = await this.#searchChannel.query(collection, bucket, query, { limit });
      log(
        `Searched in collection ${collection} with query "${query}" and bucket "${bucket}", found ${sonicResults?.length} results`,
      );
      return sonicResults?.map(id => new ObjectId(id));
    } catch (error) {
      err(`Failed to search in collection ${collection}:`, error);
      return [];
    }
  }

  async suggest(
    collection: string,
    query: string,
    bucket = 'default',
    limit = 20,
  ): Promise<string[]> {
    limit = Math.min(limit, 20);
    try {
      const sonicResults = await this.#searchChannel.suggest(collection, bucket, query, { limit });
      log(`Suggest result`, sonicResults.join(' '));
      return sonicResults;
    } catch (error) {
      err(`Failed to search in collection ${collection}:`, error);
      return [];
    }
  }
}

export const searchService = new SonicSearchService();

await searchService.waitForConnection().catch(error => {
  err(`Failed to connect to Sonic: ${error.message}`);
});

HookManager.addHook({
  collection: Collection.entity,
  type: 'afterSave',
  callback: async entity => {
    if (isEntity(entity)) {
      log(`Re-indexing document ${entity._id} using afterSave hook`);
      searchService.updateDocument(Collection.entity, entity);
      findParentCompilations(entity)
        .then(parentCompilations => {
          return Promise.all(
            parentCompilations.map(compilation => resolveCompilation(compilation)),
          );
        })
        .then(resolvedCompilations => {
          for (const compilation of resolvedCompilations) {
            if (!isCompilation(compilation)) continue;
            searchService.updateDocument(Collection.compilation, compilation);
          }
        });
    }
    return entity;
  },
});

HookManager.addHook({
  collection: Collection.compilation,
  type: 'afterSave',
  callback: async compilation => {
    if (isCompilation(compilation)) {
      log(`Re-indexing document ${compilation._id} using afterSave hook`);
      searchService.updateDocument(Collection.compilation, compilation);
    }
    return compilation;
  },
});

HookManager.addHook({
  collection: Collection.entity,
  type: 'onDelete',
  callback: async entity => {
    if (isEntity(entity)) {
      log(`Deleting document ${entity._id} from search index using onDelete hook`);
      searchService.deleteDocument(Collection.entity, entity);
    }
    return entity;
  },
});

HookManager.addHook({
  collection: Collection.compilation,
  type: 'onDelete',
  callback: async compilation => {
    if (isCompilation(compilation)) {
      log(`Deleting document ${compilation._id} from search index using onDelete hook`);
      searchService.deleteDocument(Collection.compilation, compilation);
    }

    return compilation;
  },
});

HookManager.addHook({
  collection: Collection.digitalentity,
  type: 'afterSave',
  callback: async digitalEntity => {
    if (isDigitalEntity(digitalEntity)) {
      log(`Re-indexing digital entity ${digitalEntity._id} using afterSave hook`);
      findParentEntities(digitalEntity)
        .then(parentEntities => {
          return Promise.all(parentEntities.map(parentEntity => resolveEntity(parentEntity)));
        })
        .then(resolvedEntities => {
          for (const resolvedEntity of resolvedEntities) {
            if (!isEntity(resolvedEntity)) continue;
            searchService.updateDocument(Collection.entity, resolvedEntity);
          }
        });
    }
    return digitalEntity;
  },
});
