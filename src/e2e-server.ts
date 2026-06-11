import Elysia from 'elysia';
import { openapi } from '@elysiajs/openapi';
import finalServer from './server.final';
import { RouterTagsAsTagObjects } from './routers/tags';
import cologneCaveRouter from './plugins/cologne-cave/router';
import dfgMetsRouter from './plugins/dfg-mets/router';
import oidcRouter from './plugins/oidc/router';
import sketchfabImportRouter from './plugins/sketchfab-importer/router';
import ssoNFDI4CultureRouter from './plugins/sso-nfdi4culture/router';
import wikibaseRouter from './plugins/wikibase/router';

const final = new Elysia({
  prefix: '/server',
  serve: {
    // 4096MB
    maxRequestBodySize: 4096 * 1024 * 1024,
    // Long timeout
    idleTimeout: 255,
  },
})
  .use(cologneCaveRouter)
  .use(dfgMetsRouter)
  .use(oidcRouter)
  .use(sketchfabImportRouter)
  .use(ssoNFDI4CultureRouter)
  .use(wikibaseRouter)
  .use(finalServer)
  .use(
    openapi({
      documentation: {
        info: {
          title: 'Kompakkt API Documentation',
          version: '2.0.0',
        },
        tags: RouterTagsAsTagObjects,
      },
    }),
  );

/**
 * Exports the final server instance, which includes all routes and plugins.
 * Intended to be used with @elysiajs/eden for type-safe unit testing.
 * Intended to be used to generate OpenAPI specifications for consumers.
 */
export const EndToEndServer = final;
export type EndToEndServerType = typeof final;
