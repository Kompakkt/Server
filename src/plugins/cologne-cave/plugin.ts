import { Plugin } from '../plugin-controller';
import cologneCaveRouter from './router';

class CologneCavePlugin extends Plugin {
  routers = [cologneCaveRouter];

  async load(pluginArgs?: unknown): Promise<boolean> {
    return true;
  }
}

export default new CologneCavePlugin();
