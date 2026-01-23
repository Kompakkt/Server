import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { BehaviorSubject, map } from 'rxjs';
import type Elysia from 'elysia';
import { err, info, log } from 'src/logger';
import configServer from 'src/server.config';

// Elysia with all generics set to any for maximum compatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyElysia = Elysia<any, any, any, any, any, any, any>;

export abstract class Plugin {
  abstract routers: AnyElysia[];
  abstract load(pluginArgs?: unknown): Promise<boolean>;
}

const getRoutes = (router: AnyElysia) => {
  return router.routes.map(route => route.path);
};

export const PluginController = new (class {
  #plugins$ = new BehaviorSubject<Plugin[]>([]);
  readonly routers$ = this.#plugins$.pipe(
    map(plugins => plugins.flatMap(plugin => plugin.routers)),
  );

  async loadPlugin(plugin: Plugin, pluginArgs?: unknown) {
    log(`Loading plugin ${plugin.constructor.name}`);
    const loaded = await plugin.load(pluginArgs).catch(error => {
      err(`Plugin load error ${plugin.constructor.name}`, error);
      return false;
    });
    info(`${plugin.constructor.name} loaded: ${loaded}`);
    if (!loaded) return false;
    this.#plugins$.next([...this.#plugins$.getValue(), plugin]);
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

const initializePlugin = async (
  file: string,
): Promise<{ shouldLoad: boolean; loaded: boolean }> => {
  const plugin = await import(file).then(module => module.default);
  console.log(`[Plugin] Loaded ${file}`);
  if (typeof plugin !== 'object') {
    throw new Error(`Plugin ${file} does not default export a class`);
  }

  if (!('constructor' in plugin)) {
    throw new Error(`Plugin ${file} does not default export a class`);
  }

  if (!('load' in plugin)) {
    throw new Error(`Plugin ${file} does not implement load() method`);
  }

  if (!('routers' in plugin)) {
    throw new Error(`Plugin ${file} does not implement routers property`);
  }

  if ('verifyShouldLoad' in plugin && typeof plugin.verifyShouldLoad === 'function') {
    const shouldLoad = await plugin.verifyShouldLoad();
    if (!shouldLoad) {
      log(`Plugin ${file} chose not to load`);
      return { shouldLoad: false, loaded: false };
    }
  }

  const loaded = await PluginController.loadPlugin(plugin);
  return { shouldLoad: true, loaded };
};

const retryList = new Set<string>();
const RETRY_INTERVALS = {
  oneMinute: 1 * 60 * 1000,
  fiveMinutes: 5 * 60 * 1000,
  oneHour: 60 * 60 * 1000,
} as const;
const retryInitializePlugin = async (retryCount = 1) => {
  if (retryList.size === 0) {
    log('No plugins to retry');
    return;
  }

  log(`Retrying failed plugins, attempt ${retryCount}`);
  for (const file of retryList) {
    try {
      const success = await initializePlugin(file);
      if (success) {
        retryList.delete(file);
        log(`Successfully loaded plugin ${file} on retry attempt ${retryCount}`);
      }
    } catch (error) {
      err(`Failed loading plugin ${file}`, error);
    }
  }

  if (retryList.size > 0) {
    // Retry every 5 minutes, and after 12 attempts, retry every hour
    setTimeout(
      () => retryInitializePlugin(retryCount++),
      retryCount >= 12 ? RETRY_INTERVALS.oneHour : RETRY_INTERVALS.fiveMinutes,
    );
  }
};

export const initializePlugins = async () => {
  const pluginDir = await readdir(import.meta.dirname, { withFileTypes: true, recursive: true });
  const pluginFiles = pluginDir
    .filter(entry => entry.name.includes('plugin.ts'))
    .map(file => join(file.parentPath, file.name));

  for (const file of pluginFiles) {
    try {
      const requirementsFile = file.replace('plugin.ts', 'plugin.requirements.ts');

      const requirementsMet = await (async () => {
        const exists = await Bun.file(requirementsFile).exists();
        if (!exists) return true; // No requirements file means no requirements to check
        try {
          log(`Checking requirements for plugin ${file}`);
          const checkRequirements: () => unknown | Promise<unknown> = await import(
            requirementsFile
          ).then(module => module.default);
          const valid = !!(await checkRequirements());
          return valid;
        } catch (error) {
          err(`Failed loading requirements for plugin ${file}`, error);
          return false;
        }
      })().catch(error => {
        err(`Error checking requirements for plugin ${file}`, error);
        return false;
      });

      if (!requirementsMet) {
        log(`Skipping plugin ${file} due to unmet requirements`);
        throw new Error(`Unmet requirements for plugin ${file}`);
      }

      const { loaded, shouldLoad } = await initializePlugin(file);
      if (!loaded && shouldLoad) {
        retryList.add(file);
      }
    } catch (error) {
      err(`Failed loading plugin ${file}`, error);
    }
  }

  if (retryList.size > 0) {
    // Start retry mechanism after one minute
    setTimeout(() => retryInitializePlugin(1), RETRY_INTERVALS.oneMinute);
  }
};
