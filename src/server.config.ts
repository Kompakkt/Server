import corsPlugin from '@elysiajs/cors';
import { type JWTOption, jwt } from '@elysiajs/jwt';
import timingPlugin from '@elysiajs/server-timing';
import { Elysia, t } from 'elysia';
import { Configuration } from './configuration';
import { RootDirectory } from './environment';
import { err } from './logger';
import { RouterTags } from './routers/tags';

export const jwtOptions: JWTOption = {
  secret: Bun.env.JWT_SECRET ?? 'secret',
};

// This Elysia instance is used for setting up plugins.
// It is seperate from where the server is started an the routes are loaded.
// This is so that we can import this instance for type-safety of plugins.
const configServer = new Elysia({
  cookie: {
    secrets: ['secret'],
    sign: ['auth'],
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
  },
  name: 'configServer',
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
  .onError(({ error, code }) => {
    if (code === 'NOT_FOUND') {
      return;
    }
    err(error);
    return;
  })
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
  .use(jwt(jwtOptions))
  .use(corsPlugin({}))
  .use(timingPlugin());

export default configServer;
