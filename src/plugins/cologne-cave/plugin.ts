import { Plugin } from '../plugin-controller';
import cologenCaveRouter from './router';

class CologneCavePlugin extends Plugin {
  routers = [cologenCaveRouter];

  async load(pluginArgs?: unknown): Promise<boolean> {
    return true;
  }
}

export default new CologneCavePlugin();
