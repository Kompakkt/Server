import { Elysia } from 'elysia';
import configServer from 'src/server.config';
import { authService } from './handlers/auth.service';

const cleaningRouter = new Elysia()
  .use(configServer)
  .use(authService)
  .group('/cleaning', group =>
    group
      .post('/deletenullrefs/:confirm?', ({ status }) => status(501))
      .post('/deleteunused/:confirm?', ({ status }) => status(501))
      .post('/cleanuploadedfiles/:confirm?', ({ status }) => status(501))
      .post('/combinepersons/:confirm?', async ({ status }) => status(501)),
  );

export default cleaningRouter;
