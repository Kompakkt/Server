import './util/patch-structured-clone';
import { ensureUploadStructure } from './jobs/ensure-upload-structure';
import { info } from './logger';
import finalServer from './server.final';

await Promise.allSettled([ensureUploadStructure()]);

finalServer.listen(3030, () => {
  info('Listening on port 3030');
  info('Swagger UI available at http://localhost:3030/swagger');
});
