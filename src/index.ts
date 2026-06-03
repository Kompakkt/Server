import { openapi } from '@elysiajs/openapi';
import prometheusPlugin from 'elysia-prometheus';
import Elysia, { t } from 'elysia';
import type { OpenAPIV3 } from 'openapi-types';
import './util/patch-structured-clone';

import { err, info, log } from './logger';
import { buildCommonComponentsSchemas } from './openapi-schemas';
import { initializePlugins, PluginController, type AnyElysia } from './plugins/plugin-controller';
import finalServer from './server.final';
import { RouterTags, RouterTagsAsTagObjects } from './routers/tags';

import { migrateUserProfiles } from './jobs/migrate-user-profiles';
import { cleanupPersons } from './jobs/cleanup-persons';
import { decreatePopularityTimer } from './jobs/decrease-popularity-timer';
import { ensureGaplessLicenses } from './jobs/ensure-gapless-licenses';
import { ensureSearchIndex } from './jobs/ensure-search-index';
import { ensureSortableProperties } from './jobs/ensure-sortable-properties';
import { ensureUploadStructure } from './jobs/ensure-upload-structure';
import { ensureFilterableProperties } from './jobs/ensure-filterable-properties';
import { ensureEntitySettingsScaleAsVector } from './jobs/ensure-entity-settings-scale-as-vector';
import { ensureDefaultUserProfile } from './jobs/ensure-default-user-profile';
import { ensureEntityCreatorIsProfile } from './jobs/ensure-entity-creator-is-profile';
import { ensureDefaultPasswordStrategy } from './jobs/ensure-default-password-strategy';
import { migrateCreatorAndAccessFields } from './jobs/migrate-creator-and-access-fields';
import { migrateFinishedDraftEntities } from './jobs/migrate-finished-draft-entities';
import { migrateCompilationOnline } from './jobs/migrate-compilation-online';
import { RootDirectory } from './environment';
import { Configuration } from './configuration';

const jobs = {
  migrateUserProfiles,
  migrateCreatorAndAccessFields,
  migrateFinishedDraftEntities,
  migrateCompilationOnline,
  cleanupPersons,
  decreatePopularityTimer,
  ensureDefaultPasswordStrategy,
  ensureGaplessLicenses,
  ensureSearchIndex,
  ensureSortableProperties,
  ensureUploadStructure,
  ensureFilterableProperties,
  ensureEntitySettingsScaleAsVector,
  ensureDefaultUserProfile,
  ensureEntityCreatorIsProfile,
} as const;
for (const [name, job] of Object.entries(jobs)) {
  log(`Running job ${name}`);
  await job().catch(err);
  log(`Job ${name} completed`);
}

let final: AnyElysia | undefined;
await initializePlugins();

PluginController.routers$.subscribe(async routerConfigs => {
  let app: AnyElysia = new Elysia();

  for (const pluginRouter of Object.values(routerConfigs)) {
    for (const config of Object.values(pluginRouter)) {
      app = app.use(config.router);
    }
  }
  const pluginRouterTags: OpenAPIV3.TagObject[] = Object.values(routerConfigs).flatMap(
    pluginRouter =>
      Object.values(pluginRouter).map(
        config =>
          ({
            name: config.tag,
            description: config.description,
          }) satisfies OpenAPIV3.TagObject,
      ),
  );

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
    .onRequest(({ request: { url, method, headers }, status }) => {
      url = url.slice(url.indexOf('/server/') + 7);
      if (url.indexOf('/previews') === -1) {
        queueMicrotask(() => {
          const date = new Date().toISOString().replaceAll(/[TZ]/g, ' ').trim();
          const user = Bun.hash(headers.get('cookie') ?? '');
          console.log(
            `\x1B[2m${date} \x1B[1m${method.padEnd(7, ' ')}\x1B[22m \x1B[2m${user}:${url}\x1B[22m`,
          );
        });
      }
      if (url.indexOf('/metrics') >= 0) {
        const key = new URL(`http://example.com${url}`).searchParams.get('key');
        if (!key) return status('Unauthorized', 'Incorrect API key');
        if (key !== Configuration.Server.MonitoringToken)
          return status('Unauthorized', 'Incorrect API key');
      }
      return;
    })
    .onError(({ error, code, status, path }) => {
      if (
        code === 'VALIDATION' &&
        typeof error.messageValue === 'object' &&
        error.messageValue != null &&
        'path' in error.messageValue &&
        typeof error.messageValue.path === 'string'
      ) {
        // Check if error is because of _id being ObjectId instead of string
        if (error.messageValue.path.endsWith('/_id')) {
          // Check if it was the only validation error
          if (error.messageValue.errors.length === 1) {
            return status(200, error.value);
          }
        }
      }
    })
    .use(app)
    .use(finalServer)
    .use(
      openapi({
        scalar: {
          agent: {
            disabled: true,
          },
          mcp: {
            disabled: true,
          },
          favicon: '/server/favicon.ico',
          telemetry: false,
          showDeveloperTools: 'always',
          withDefaultFonts: false,
        },
        documentation: {
          info: {
            title: 'Kompakkt API',
            description:
              'Documentation for available routes of the Kompakkt Server, including schemas for data structures used in requests and responses, and in code.',
            version: '2.0.0',
          },
          tags: [...RouterTagsAsTagObjects, ...pluginRouterTags],
          components: { schemas: buildCommonComponentsSchemas() },
        },
        exclude: {
          paths: ['/server/metrics', '/server/csp-report'],
        },
      }),
    )
    .use(
      prometheusPlugin({
        metricsPath: '/metrics',
        staticLabels: { service: 'kompakkt-server' },
        dynamicLabels: {
          userAgent: ctx => ctx.request.headers.get('user-agent') ?? 'unknown',
        },
      }),
    )
    .get(
      '/health',
      ({ set }) => {
        set.status = 200;
        return { status: 'OK' };
      },
      {
        response: {
          200: t.Object({ status: t.Literal('OK') }),
        },
        detail: {
          description: 'Health check endpoint',
          tags: [RouterTags.Monitoring],
        },
      },
    )
    .get('/favicon.ico', () => Bun.file(`${RootDirectory}/assets/favicon.ico`))
    .get(
      '/previews/*',
      async ({ params, status }) => {
        let path = params['*'];
        const file = Bun.file(
          `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/previews/${path}`,
        );
        if (await file.exists()) return file;

        // PNG Fallback
        // TODO: Migration to convert PNG to WEBP and remove this fallback
        if (path.includes('.webp')) {
          path = path.replace('.webp', '.png');
          const file = Bun.file(
            `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/previews/${path}`,
          );
          if (await file.exists()) return file;
        }

        return status(404, 'Preview not found');
      },
      {
        response: {
          200: t.File(),
          404: t.Any(),
        },
        detail: {
          description:
            'Serve preview files. This endpoint is used internally by the frontend and should not be used directly.',
          tags: [RouterTags.Utility],
        },
      },
    )
    .post('/csp-report', ({ status }) => {
      return status(200);
    });

  final?.listen(3030, () => {
    info('Listening on port 3030');
  });
});
