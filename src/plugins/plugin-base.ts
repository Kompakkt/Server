import type Elysia from 'elysia';

export abstract class Plugin {
  abstract routers: Elysia<any, any, any>[];

  abstract verifyShouldLoad(): Promise<boolean>;
  abstract load(pluginArgs?: unknown): Promise<boolean>;
}
