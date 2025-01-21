import './util/patch-structured-clone';
import { ensureUploadStructure } from './jobs/ensure-upload-structure';
import { err, info } from './logger';
import finalServer from './server.final';
import { initializePlugins } from './plugins';
import Elysia from 'elysia';
import { ensureMd5Checksums } from './jobs/ensure-md5-checksums';

const jobs = [ensureUploadStructure, ensureMd5Checksums] as const;
for (const job of jobs) {
  await job().catch(err);
}

const pluginRoutes = await initializePlugins();

let app: Elysia = new Elysia();
for (const router of pluginRoutes) {
  app.use(router);
}

finalServer.use(app).listen(3030, () => {
  info('Listening on port 3030');
  info('Swagger UI available at http://localhost:3030/swagger');
});
