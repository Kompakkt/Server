import { Elysia, t } from 'elysia';
import configServer from 'src/server.config';
import { authService, signInBody } from './handlers/auth.service';

const testingRouter = new Elysia()
  .use(configServer)
  .use(authService)
  .group(
    '/testing',
    {
      isAdmin: true,
      verifyLoginData: true,
      body: signInBody,
    },
    group =>
      group
        .post('/test/:collection', ({ error }) => error(501), {
          params: t.Object({
            collection: t.String(),
          }),
        })
        .post('/testall', ({ error }) => error(501)),
  );

export default testingRouter;
