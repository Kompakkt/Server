import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type Elysia from 'elysia';
import { err, info, log } from 'src/logger';
import configServer from 'src/server.config';
import type { Plugin } from './plugin-base';

const getRoutes = (router: Elysia<any, any, any>) => {
  return router.routes.map(route => route.path);
};

export const PluginController = new (class {
  #plugins: Plugin[] = [];

  get routers() {
    return this.#plugins.flatMap(plugin => plugin.routers);
  }

  async loadPlugin(plugin: Plugin, pluginArgs?: unknown) {
    log(`Loading plugin ${plugin.constructor.name}`);
    const shouldLoad = await plugin.verifyShouldLoad();
    info(`${plugin.constructor.name} shouldLoad: ${shouldLoad}`);
    if (!shouldLoad) return false;
    const loaded = await plugin.load(pluginArgs);
    info(`${plugin.constructor.name} loaded: ${loaded}`);
    if (!loaded) return false;
    this.#plugins.push(plugin);
    const configServerRoutes = getRoutes(configServer);
    const routes = plugin.routers
      .flatMap(getRoutes)
      .filter(route => !configServerRoutes.includes(route));
    log(
      `Registered plugin ${plugin.constructor.name} with ${routes.length} routes\n${routes.join('\n')}`,
    );
    return true;
  }
})();

export const initializePlugins = async () => {
  const pluginDir = await readdir(import.meta.dirname, { withFileTypes: true, recursive: true });
  const pluginFiles = pluginDir
    .filter(entry => entry.name.includes('plugin.ts'))
    .map(file => join(file.parentPath, file.name));

  for (const file of pluginFiles) {
    try {
      const plugin = await import(file).then(module => module.default);
      await PluginController.loadPlugin(plugin);
    } catch (error) {
      err(`Failed loading plugin ${file}`, error);
    }
  }

  return PluginController.routers;
};
