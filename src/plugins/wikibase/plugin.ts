import {
  Collection,
  type IEntity,
  isDigitalEntity,
  type IAnnotation,
  type IDigitalEntity,
} from '@kompakkt/common';
import { log } from 'src/logger';
import { HookManager } from 'src/routers/modules/api.v1/hooks';
import { type ServerDocument } from 'src/util/document-with-objectid-type';
import { isWikibaseConfiguration, isWikibaseDigitalEntity, WikibaseConfiguration } from './config';
import { Plugin } from '../plugin-controller';
import {
  ensureAnnotationExtensionData,
  ensureDigitalEntityExtensionData,
  hasWikibaseExtension,
} from './ensure-extension-data';
import wikibaseRouter from './router';
import { WikibaseService } from './service';
import { pluginCache } from 'src/redis';
import type { IWikibaseDigitalEntityExtensionData } from './common';
import { restoreOriginalAnnotation } from './restore-original-data-model';
import { SearchIndexJobState } from 'src/jobs/ensure-search-index';
import { digitalEntityCollection, entityCollection } from 'src/mongo';
import {
  resolveDigitalEntity,
  resolveEntity,
} from 'src/routers/modules/api.v1/resolving-strategies';
import { ObjectId } from 'mongodb';
import { get } from 'src/util/requests';

const disableDeletedWikibaseEntities = async (): Promise<void> => {
  const service = WikibaseService.getInstance();
  if (!service) {
    log('Wikibase plugin not initialized');
    return;
  }

  log('Waiting for search index to be built');
  await new Promise<void>(resolve => {
    const checkIsDone = () => {
      if (SearchIndexJobState.isDone) {
        resolve();
      } else {
        setTimeout(checkIsDone, 1000);
      }
    };
    if (SearchIndexJobState.isDone) {
      resolve();
    } else {
      checkIsDone();
    }
  });
  log('Search index built');

  const entitiesWithoutExtensionData = new Array<[string, string]>();

  const entities = await entityCollection.find({ finished: true, online: true }).toArray();
  for (const entity of entities) {
    const resolved = await resolveDigitalEntity({ _id: entity.relatedDigitalEntity._id }, 0);
    if (!resolved) continue;
    if (typeof resolved !== 'object') continue;
    if (!hasWikibaseExtension(resolved)) continue;

    if (!isWikibaseDigitalEntity(resolved)) continue;
    const hasLabel =
      resolved.extensions?.wikibase?.label &&
      'en' in resolved.extensions!.wikibase!.label &&
      typeof resolved.extensions!.wikibase!.label.en === 'string' &&
      resolved.extensions!.wikibase!.label.en.trim().length > 0;

    if (!hasLabel) {
      entitiesWithoutExtensionData.push([
        entity._id.toString(),
        resolved.extensions?.wikibase?.id ?? '',
      ]);
    }
  }

  for (const [entityId, wikibaseId] of entitiesWithoutExtensionData) {
    log(`Disabling entity ${entityId} without wikibase data: ${wikibaseId}`);
    await entityCollection.updateOne(
      { _id: new ObjectId(entityId) },
      { $set: { online: false, finished: false } },
    );
  }
};

class WikibasePlugin extends Plugin {
  routers = [wikibaseRouter];
  jobs = [
    // TODO: Test on dev instance
    // disableDeletedWikibaseEntities
  ];

  async load(pluginArgs?: unknown): Promise<boolean> {
    if (!WikibaseConfiguration || !isWikibaseConfiguration(WikibaseConfiguration)) {
      log('Wikibase configuration not found');
      return false;
    }

    // Check if we can reach the Wikibase instance
    let domain = WikibaseConfiguration.Domain;
    if (!domain.startsWith('http')) {
      domain = `http://${domain}`;
    }
    const paramInfo = await get(
      new URL('api.php?action=paraminfo&modules=query&format=json', domain).toString(),
      { responseFormat: 'json' },
    ).catch(() => undefined);
    if (!paramInfo) {
      log('Wikibase instance not reachable');
      return false;
    }

    const service = WikibaseService.getInstance();
    if (!service) {
      log('Wikibase plugin not initialized');
      return false;
    }

    log('Registering hooks');
    HookManager.addHook<ServerDocument<IEntity>>({
      collection: Collection.entity,
      type: 'afterSave',
      callback: async entity => {
        // When an entity is saved, it could be because it is being finalized/set to finished.
        // We can use this to ensure that the related digital entity is also updated in Wikibase.
        if (!entity.finished) return entity;

        const digitalEntity = await resolveDigitalEntity(
          { _id: entity.relatedDigitalEntity._id },
          0,
        );
        if (!digitalEntity) {
          log(`Related digital entity not found for entity ${entity._id}`);
          return entity;
        }

        // Transform digital entity
        const doc = ensureDigitalEntityExtensionData(digitalEntity);
        const result = await service.updateDigitalEntity(doc);
        if (!result) {
          throw new Error('Failed to update wikibase digital entity');
        }
        doc.extensions!.wikibase!.id = result.itemId;
        doc.extensions!.wikibase!.address =
          WikibaseConfiguration?.Public ?? WikibaseConfiguration?.Domain;

        // Now we just need to update the digital entity
        log(
          `Updating digital entity ${digitalEntity._id} with Wikibase extension data ${JSON.stringify(doc.extensions?.wikibase ?? {})}`,
        );
        const updateResult = await digitalEntityCollection
          .updateOne(
            { _id: new ObjectId(digitalEntity._id) },
            { $set: { extensions: doc.extensions } },
          )
          .catch(error => {
            log(`Failed to update digital entity ${digitalEntity._id}: ${error}`);
          });
        log(
          `Updated digital entity ${digitalEntity._id} with Wikibase extension data, result: ${JSON.stringify(updateResult)}`,
        );

        return entity;
      },
    });

    HookManager.addHook<ServerDocument<IDigitalEntity>>({
      collection: Collection.digitalentity,
      type: 'onTransform',
      callback: async digitalEntity => {
        if (!hasWikibaseExtension(digitalEntity)) {
          log(`Item is probably not a wikibase digital entity`);
          return digitalEntity;
        }

        const doc = ensureDigitalEntityExtensionData(digitalEntity);
        const result = await service.updateDigitalEntity(doc);
        if (!result) {
          throw new Error('Failed to update wikibase digital entity');
        }
        doc.extensions!.wikibase!.id = result.itemId;
        doc.extensions!.wikibase!.address =
          WikibaseConfiguration?.Public ?? WikibaseConfiguration?.Domain;
        // log('After Wikibase transform', Bun.inspect(doc));
        return doc;
      },
    });

    HookManager.addHook<ServerDocument<IAnnotation>>({
      collection: Collection.annotation,
      type: 'onTransform',
      callback: async annotation => {
        if (!hasWikibaseExtension(annotation)) {
          log(`Item is probably not a wikibase annotation`);
          return annotation;
        }

        if (!annotation.body.content.title.trim() || !annotation.body.content.description.trim()) {
          log(`Annotation is missing title or description for wikibase extension`);
          return annotation;
        }

        const doc = ensureAnnotationExtensionData(annotation);
        const result = await service.updateAnnotation(doc, {});
        if (!result) {
          throw new Error('Failed to update wikibase annotation');
        }
        doc.extensions!.wikibase!.id = result.itemId;
        doc.extensions!.wikibase!.address =
          WikibaseConfiguration?.Public ?? WikibaseConfiguration?.Domain;
        // log('After Wikibase transform', Bun.inspect(doc));
        return doc;
      },
    });

    HookManager.addHook<ServerDocument<IDigitalEntity>>({
      collection: Collection.digitalentity,
      type: 'onResolve',
      callback: async digitalEntity => {
        try {
          if (!SearchIndexJobState.isDone) {
            // log('Search index job is not done, skipping wikibase transform');
            return digitalEntity;
          }
          if (!hasWikibaseExtension(digitalEntity)) {
            log(`Item is probably not a wikibase digital entity`);
            return digitalEntity as ServerDocument<IDigitalEntity>;
          }

          log(`Resolving wikibase digital entity ${digitalEntity._id}`);

          const doc = ensureDigitalEntityExtensionData(digitalEntity);
          const wikibaseId = doc.extensions?.wikibase?.id;
          if (!wikibaseId) {
            log(`Wikibase ID not found for digital entity ${digitalEntity._id}`);
            return digitalEntity;
          }

          const extensionData = await (async () => {
            const key = `wikibase::fetchWikibaseMetadata::${wikibaseId}`;
            const cached = await pluginCache.get<IWikibaseDigitalEntityExtensionData>(key);
            if (cached) return cached;
            const fresh = await service.fetchWikibaseMetadata(wikibaseId);
            if (!fresh) return undefined;
            await pluginCache.set(key, fresh, 3600);
            return fresh;
          })().catch(error => {
            console.log(error);
            return undefined;
          });

          if (extensionData) doc.extensions!.wikibase = extensionData;
          return doc;
        } catch (error) {
          log(`Error resolving wikibase digital entity: ${error}`);
        }
        return digitalEntity;
      },
    });

    HookManager.addHook<ServerDocument<IAnnotation>>({
      collection: Collection.annotation,
      type: 'onResolve',
      callback: async annotation => {
        try {
          if (!SearchIndexJobState.isDone) {
            // log('Search index job is not done, skipping wikibase transform');
            return annotation;
          }
          if (!hasWikibaseExtension(annotation)) {
            log(`Item is probably not a wikibase annotation`);
            return annotation as ServerDocument<IAnnotation>;
          }

          log(`Resolving wikibase annotation ${annotation._id}`);

          const restored = restoreOriginalAnnotation(annotation);
          const doc = ensureAnnotationExtensionData(restored);
          const wikibaseId = doc.extensions?.wikibase?.id;
          if (!wikibaseId) {
            log(`Wikibase ID not found for annotation ${annotation._id}`);
            return annotation;
          }

          const extensionData = await (async () => {
            const key = `wikibase::fetchAnnotation::${wikibaseId}`;
            //const cached = await pluginCache.get<IWikibaseDigitalEntityExtensionData>(key);
            //if (cached) return cached;
            const fresh = await service.fetchAnnotation(wikibaseId);
            if (!fresh) return undefined;
            await pluginCache.set(key, fresh, 3600);
            return fresh;
          })().catch(error => {
            console.log(error);
            return undefined;
          });

          if (extensionData) {
            doc.extensions!.wikibase = extensionData;
            doc.body.content.title ||= extensionData.label?.en ?? '';
            doc.body.content.description ||= extensionData.description?.en ?? '';
          }
          return doc;
        } catch (error) {
          log(`Error resolving wikibase annotation: ${error}`);
        }
        return annotation;
      },
    });

    return true;
  }

  async verifyShouldLoad(): Promise<boolean> {
    return true;
  }
}

export default new WikibasePlugin();
