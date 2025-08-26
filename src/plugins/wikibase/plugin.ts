import { Collection, type IAnnotation, type IDigitalEntity } from 'src/common';
import { log } from 'src/logger';
import { HookManager } from 'src/routers/modules/api.v1/hooks';
import { type ServerDocument } from 'src/util/document-with-objectid-type';
import { Plugin } from '../plugin-base';
import { isWikibaseConfiguration, WikibaseConfiguration } from './config';
import {
  ensureAnnotationExtensionData,
  ensureDigitalEntityExtensionData,
  hasWikibaseExtension,
} from './ensure-extension-data';
import wikibaseRouter from './router';
import { WikibaseService } from './service';
import { pluginCache } from 'src/redis';
import type { IWikibaseDigitalEntityExtensionData } from './common';

class WikibasePlugin extends Plugin {
  routers = [wikibaseRouter];

  async load(pluginArgs?: unknown): Promise<boolean> {
    if (!WikibaseConfiguration || !isWikibaseConfiguration(WikibaseConfiguration)) {
      log('Wikibase configuration not found');
      return false;
    }

    const service = WikibaseService.getInstance();
    if (!service) {
      log('Wikibase plugin not initialized');
      return false;
    }

    log('Registering hooks');
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
          })();

          if (extensionData) doc.extensions!.wikibase = extensionData;
        } catch (error) {
          log(`Error resolving wikibase digital entity: ${error}`);
        }
        return digitalEntity;
      },
    });

    return true;
  }

  async verifyShouldLoad(): Promise<boolean> {
    return true;
  }
}

export default new WikibasePlugin();
