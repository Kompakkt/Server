import { Plugin } from '../plugin-controller';
import oidcRouter from './router';

class OIDCPlugin extends Plugin {
  routers = [oidcRouter];

  async load(pluginArgs?: unknown): Promise<boolean> {
    return true;
  }
}

export default new OIDCPlugin();
