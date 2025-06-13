import type Elysia from 'elysia';

export abstract class Plugin {
  abstract routers: Elysia<any, any, any>[];
  abstract load(pluginArgs?: unknown): Promise<boolean>;
}
