import { info, log } from 'src/logger';
import { Plugin } from '../plugin-base';
import {
  type IWikibaseItem,
  getDigitalEntityMetadataSpark,
  isWikibaseConfiguration,
} from './common';
import { WikibaseConfiguration } from './config';
import wikibaseRouter from './router';
import { type MetadataResponseItem, WikibaseService } from './service';

const ids = [
  'Q574',
  'Q779',
  'Q1041',
  'Q1037',
  'Q1031',
  'Q1029',
  'Q1084',
  'Q1100',
  'Q1036',
  'Q1032',
  'Q1061',
  'Q1038',
  'Q1034',
  'Q1035',
  'Q1088',
];

const combinedResult: Record<string, any> = {};

class WikibasePlugin extends Plugin {
  routers = [wikibaseRouter];

  #service: WikibaseService | undefined;

  async load(pluginArgs?: unknown): Promise<boolean> {
    if (!WikibaseConfiguration || !isWikibaseConfiguration(WikibaseConfiguration)) {
      log('Wikibase configuration not found');
      return false;
    }

    const service = new WikibaseService();
    this.#service = service;

    // Create and delete test entity
    /*const createdTestEntity = await service.wbEdit.entity.create({
      type: 'item',
      labels: { en: 'Test entity' },
      descriptions: { en: 'Test entity for testing' },
    });

    info('test entity', createdTestEntity);

    const deletedTestEntity = await service.wbEdit.entity.delete({
      id: createdTestEntity.entity.id,
    });
    info('deleted test entity', deletedTestEntity);*/

    /*for (const id of ids) {
      const data = await service.wikibase_read<MetadataResponseItem>(
        getDigitalEntityMetadataSpark(id),
      );
      if (!data) {
        info('Failed getting', id);
        combinedResult[id] = 'Error';
        continue;
      }
      const processed = service.processRawMetadata(data);
      info('Processed', id, processed);
      combinedResult[id] = processed;
    }
    info(combinedResult);*/

    return true;
  }

  async verifyShouldLoad(): Promise<boolean> {
    return true;
  }
}

export default new WikibasePlugin();
