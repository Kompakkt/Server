import { Plugin } from '../plugin-controller';
import sketchfabImportRouter, { sketchfabImportRouterTag } from './router';

class SketchfabImportPlugin extends Plugin {
  routers = {
    sketchfabImportRouter: {
      router: sketchfabImportRouter,
      tag: sketchfabImportRouterTag,
      description: 'Router for Sketchfab Importer API endpoints',
    },
  };

  async load(pluginArgs?: unknown): Promise<boolean> {
    return true;
  }
}

export default new SketchfabImportPlugin();
