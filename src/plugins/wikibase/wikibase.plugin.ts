import type Elysia from 'elysia';
import { Plugin } from '../plugin-base';
import wikibaseRouter from './wikibase.router';

class WikibasePlugin extends Plugin {
  routers = [wikibaseRouter];

  async load(pluginArgs?: unknown): Promise<boolean> {
    return true;
  }

  async verifyShouldLoad(): Promise<boolean> {
    return true;
  }
}

export default new WikibasePlugin();
