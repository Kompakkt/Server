import corsPlugin from '@elysiajs/cors';
import { type JWTOption, jwt } from '@elysiajs/jwt';
import timingPlugin from '@elysiajs/server-timing';
import prometheusPlugin from 'elysia-prometheus';
import { Elysia, t } from 'elysia';
import { Configuration } from './configuration';
import { RootDirectory } from './environment';
import { err, log, warn } from './logger';

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
        // eslint-disable-next-line no-console
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
  })
  .onError(({ error, code }) => {
    if (code === 'NOT_FOUND') {
      return;
    }
    err(error);
  })
  .use(
    prometheusPlugin({
      metricsPath: '/metrics',
      staticLabels: { service: 'kompakkt-server' },
      dynamicLabels: {
        userAgent: ctx => ctx.request.headers.get('user-agent') ?? 'unknown',
      },
    }),
  )
  .get('/health', ({ set }) => {
    set.status = 200;
    return { status: 'OK' };
  })
  .get('/favicon.ico', () => Bun.file(`${RootDirectory}/assets/favicon.ico`))
  .use(jwt(jwtOptions))
  .use(corsPlugin({}))
  .use(timingPlugin({}))
  .get('/previews/*', async ({ params, status }) => {
    const file = Bun.file(
      `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/previews/${params['*']}`,
    );
    if (await file.exists()) return file;
    return status(404, 'Preview not found');
  });

export default configServer;
