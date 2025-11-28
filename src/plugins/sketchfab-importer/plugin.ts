import { Plugin } from '../plugin-controller';
import sketchfabImportRouter from './router';

class SketchfabImportPlugin extends Plugin {
  routers = [sketchfabImportRouter];

  async load(pluginArgs?: unknown): Promise<boolean> {
    return true;
  }
}

export default new SketchfabImportPlugin();
