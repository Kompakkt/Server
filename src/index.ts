import './util/patch-structured-clone';
import Elysia from 'elysia';
import { ensureUploadStructure } from './jobs/ensure-upload-structure';
import { err, info, log } from './logger';
import { initializePlugins } from './plugins';
import finalServer from './server.final';
import { swagger } from '@elysiajs/swagger';

const jobs = { ensureUploadStructure } as const;
for (const [name, job] of Object.entries(jobs)) {
  log(`Running job ${name}`);
  await job().catch(err);
  log(`Job ${name} completed`);
}

const pluginRoutes = await initializePlugins();

const app: Elysia = new Elysia();
for (const router of pluginRoutes) {
  app.use(router);
}

new Elysia({
  serve: {
    // 4096MB
    maxRequestBodySize: 4096 * 1024 * 1024,
  },
})
  .use(app)
  .use(finalServer)
  .use(
    swagger({
      documentation: {
        info: {
          title: 'Kompakkt Server Documentation',
          description: 'The Kompakkt Server API Documentation',
          version: '1.0.0',
        },
      },
    }),
  )
  .get('/swagger/swagger/json', ({ redirect }) => redirect('/swagger/json'))
  .listen(3030, () => {
    info('Listening on port 3030');
    info('Swagger UI available at http://localhost:3030/swagger');
  });
