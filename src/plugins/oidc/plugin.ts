import { Plugin } from '../plugin-controller';
import oidcRouter, { oidcRouterTag } from './router';

class OIDCPlugin extends Plugin {
  routers = {
    oidcRouter: {
      router: oidcRouter,
      tag: oidcRouterTag,
      description: 'OIDC authentication endpoints',
    },
  };

  async load(pluginArgs?: unknown): Promise<boolean> {
    return true;
  }
}

export default new OIDCPlugin();
