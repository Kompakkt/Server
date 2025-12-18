import { openapi } from '@elysiajs/openapi';
import Elysia from 'elysia';
import './util/patch-structured-clone';

import { err, info, log } from './logger';
import {
  initializePlugins,
  Plugin,
  PluginController,
  type AnyElysia,
} from './plugins/plugin-controller';
import finalServer from './server.final';

import { cleanupPersons } from './jobs/cleanup-persons';
import { decreatePopularityTimer } from './jobs/decrease-popularity-timer';
import { ensureGaplessLicenses } from './jobs/ensure-gapless-licenses';
import { ensureSearchIndex } from './jobs/ensure-search-index';
import { ensureSortableProperties } from './jobs/ensure-sortable-properties';
import { ensureUploadStructure } from './jobs/ensure-upload-structure';
import { ensureFilterableProperties } from './jobs/ensure-filterable-properties';
import { ensureEntitySettingsScaleAsVector } from './jobs/ensure-entity-settings-scale-as-vector';
import { RouterTagsAsTagObjects } from './routers/tags';

const jobs = {
  ensureUploadStructure,
  ensureSearchIndex,
  ensureGaplessLicenses,
  ensureSortableProperties,
  ensureFilterableProperties,
  ensureEntitySettingsScaleAsVector,
  cleanupPersons,
  decreatePopularityTimer,
} as const;
for (const [name, job] of Object.entries(jobs)) {
  log(`Running job ${name}`);
  await job().catch(err);
  log(`Job ${name} completed`);
}

let final: AnyElysia | undefined;
await initializePlugins();

PluginController.routers$.subscribe(async routers => {
  let app: AnyElysia = new Elysia();

  for (const router of routers) {
    app = app.use(router);
  }

  if (final) {
    await final.stop(true);
  }

  final = new Elysia({
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
    )
    .post('/csp-report', ({ status }) => {
      return status(200);
    });

  final?.listen(3030, () => {
    info('Listening on port 3030');
  });
});
