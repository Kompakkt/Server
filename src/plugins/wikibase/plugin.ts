import { log } from 'src/logger';
import { Plugin } from '../plugin-base';
import { isWikibaseConfiguration } from './common';
import { WikibaseConfiguration } from './config';
import wikibaseRouter from './router';
import { WikibaseService } from './service';

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

    service.fetchHierarchy('Q1041');

    return true;
  }

  async verifyShouldLoad(): Promise<boolean> {
    return false;
  }
}

export default new WikibasePlugin();
