import { Plugin } from '../plugin-controller';
import dfgMetsRouter, { dfgMetsRouterTag } from './router';

class DfgMetsPlugin extends Plugin {
  routers = {
    dfgMetsRouter: {
      router: dfgMetsRouter,
      tag: dfgMetsRouterTag,
      description: 'Router for DFG METS extension API endpoints',
    },
  };

  async load(pluginArgs?: unknown): Promise<boolean> {
    return true;
  }
}

export default new DfgMetsPlugin();
