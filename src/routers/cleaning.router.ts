import { Elysia, t } from 'elysia';
import configServer from 'src/server.config';
import { authService, signInBody } from './handlers/auth.service';

const cleaningRouter = new Elysia()
  .use(configServer)
  .use(authService)
  .group(
    '/cleaning',
    {
      isAdmin: true,
      verifyLoginData: true,
      body: signInBody,
      params: t.Object({
        confirm: t.Optional(t.String()),
      }),
    },
    group =>
      group
        .post('/deletenullrefs/:confirm?', ({ error }) => error(501))
        .post('/deleteunused/:confirm?', ({ error }) => error(501))
        .post('/cleanuploadedfiles/:confirm?', ({ error }) => error(501)),
  );

export default cleaningRouter;
