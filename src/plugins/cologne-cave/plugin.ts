import { Plugin } from '../plugin-controller';
import cologneCaveRouter, { cologneCaveRouterTag } from './router';

class CologneCavePlugin extends Plugin {
  routers = {
    cologneCaveRouter: {
      router: cologneCaveRouter,
      tag: cologneCaveRouterTag,
      description: 'Routes for Cologne CAVE integration',
    },
  };

  async load(pluginArgs?: unknown): Promise<boolean> {
    return true;
  }
}

export default new CologneCavePlugin();
