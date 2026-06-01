import { Plugin } from '../plugin-controller';
import ssoNFDI4CultureRouter, { SSONFDI4CultureRouterTag } from './router';

class SSONFDI4CulturePlugin extends Plugin {
  routers = {
    ssoNFDI4Culture: {
      router: ssoNFDI4CultureRouter,
      tag: SSONFDI4CultureRouterTag,
      description: 'Handles SAML-based Single Sign-On (SSO) authentication for NFDI4Culture users.',
    },
  };
  jobs = [];

  async load(pluginArgs?: unknown): Promise<boolean> {
    return true;
  }
}

export default new SSONFDI4CulturePlugin();
