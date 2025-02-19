import './util/patch-structured-clone';
import Elysia from 'elysia';
import { ensureMd5Checksums } from './jobs/ensure-md5-checksums';
import { ensureUploadStructure } from './jobs/ensure-upload-structure';
import { err, info } from './logger';
import { initializePlugins } from './plugins';
import finalServer from './server.final';
import { swagger } from '@elysiajs/swagger';

const jobs = [ensureUploadStructure, ensureMd5Checksums] as const;
for (const job of jobs) {
  await job().catch(err);
}

const pluginRoutes = await initializePlugins();

const app: Elysia = new Elysia();
for (const router of pluginRoutes) {
  app.use(router);
}

new Elysia()
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
