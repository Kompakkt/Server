import { Plugin } from '../plugin-controller';
import dfgMetsRouter from './router';

class DfgMetsPlugin extends Plugin {
  routers = [dfgMetsRouter];

  async load(pluginArgs?: unknown): Promise<boolean> {
    return true;
  }
}

export default new DfgMetsPlugin();
