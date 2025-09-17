import './util/patch-structured-clone';
import Elysia from 'elysia';

import { err, info, log } from './logger';
import { initializePlugins } from './plugins';
import finalServer from './server.final';
import { swagger } from '@elysiajs/swagger';
import { openApiUI } from './templates/openapi-ui';

import { cleanupPersons } from './jobs/cleanup-persons';
import { ensureUploadStructure } from './jobs/ensure-upload-structure';
import { ensureSearchIndex } from './jobs/ensure-search-index';
import { ensureGaplessLicenses } from './jobs/ensure-gapless-licenses';
import { ensureSortableProperties } from './jobs/ensure-sortable-properties';
import { decreatePopularityTimer } from './jobs/decrease-popularity-timer';

const jobs = {
  ensureUploadStructure,
  ensureSearchIndex,
  ensureGaplessLicenses,
  ensureSortableProperties,
  cleanupPersons,
  decreatePopularityTimer,
} as const;
for (const [name, job] of Object.entries(jobs)) {
  log(`Running job ${name}`);
  await job().catch(err);
  log(`Job ${name} completed`);
}

const app: Elysia = new Elysia();
const pluginRoutes = await initializePlugins();

for (const router of pluginRoutes) {
  app.use(router);
}

new Elysia({
  prefix: '/server',
  serve: {
    // 4096MB
    maxRequestBodySize: 4096 * 1024 * 1024,
    // Long timeout
    idleTimeout: 255,
  },
})
  .use(
    swagger({
      provider: 'scalar',
      documentation: {
        info: {
          title: 'Kompakkt Server Documentation',
          description: 'The Kompakkt Server API Documentation',
          version: '1.0.0',
        },
      },
    }),
  )
  .use(app)
  .use(finalServer)
  .get(
    '/documentation',
    async ({ set }) => {
      set.headers['Content-Type'] = 'text/html';
      set.headers['Content-Security-Policy'] =
        `style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net`;
      return await openApiUI();
    },
    {
      detail: {
        summary: 'OpenAPI Documentation',
        description: 'Provides the OpenAPI documentation in a user-friendly HTML format.',
        responses: {
          200: {
            description: 'OpenAPI documentation in HTML format',
          },
        },
      },
    },
  )

  // .get('/swagger/swagger/json', ({ redirect }) => redirect('/swagger/json'))
  .listen(3030, () => {
    info('Listening on port 3030');
  });
