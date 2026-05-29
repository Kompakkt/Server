import Elysia from 'elysia';
import { openapi } from '@elysiajs/openapi';
import openapiTS, { astToString } from 'openapi-typescript';
import { setTimeout } from 'node:timers/promises';
import type { AnyElysia } from './plugins/plugin-controller';
import finalServer from './server.final';
import { RouterTagsAsTagObjects } from './routers/tags';
import cologneCaveRouter from './plugins/cologne-cave/router';
import dfgMetsRouter from './plugins/dfg-mets/router';
import oidcRouter from './plugins/oidc/router';
import sketchfabImportRouter from './plugins/sketchfab-importer/router';
import ssoNFDI4CultureRouter from './plugins/sso-nfdi4culture/router';
import wikibaseRouter from './plugins/wikibase/router';

let app: AnyElysia = new Elysia();

const routers: AnyElysia[] = [
  cologneCaveRouter,
  dfgMetsRouter,
  oidcRouter,
  sketchfabImportRouter,
  ssoNFDI4CultureRouter,
  wikibaseRouter,
];

for (const router of routers) {
  app = app.use(router);
}

const final = new Elysia({
  prefix: '/server',
  serve: {
    // 4096MB
    maxRequestBodySize: 4096 * 1024 * 1024,
    // Long timeout
    idleTimeout: 255,
  },
})
  .use(app)
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

final.listen(45765);

const OpenAPISpec = await Bun.fetch('http://localhost:45765/server/openapi/json').then(res =>
  res.json(),
);
const ast = await openapiTS(OpenAPISpec, {
  exportType: true,
  enum: true,
  makePathsEnum: true,
});
const contents = astToString(ast);

await Bun.write('./e2e-out/openapi-server-types.ts', contents);

await final.stop();

await setTimeout(1000);

process.exit(0);
