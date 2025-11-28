import { Plugin } from '../plugin-controller';
import ssoNFDI4CultureRouter from './router';

class SSONFDI4CulturePlugin extends Plugin {
  routers = [ssoNFDI4CultureRouter];

  async load(pluginArgs?: unknown): Promise<boolean> {
    return true;
  }
}

export default new SSONFDI4CulturePlugin();
