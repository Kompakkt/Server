import corsPlugin from '@elysiajs/cors';
import { type JWTOption, jwt } from '@elysiajs/jwt';
import timingPlugin from '@elysiajs/server-timing';
import { Elysia } from 'elysia';
import { helmet } from 'elysia-helmet';
import { Configuration } from './configuration';
import { RootDirectory } from './environment';
import { err, log } from './logger';

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
})
  .onRequest(({ request }) => {
    const url = request.url.slice(request.url.indexOf('/server/') + 7);
    if (url.indexOf('/previews') !== -1) return;
    log(`${request.method}  ${url}`);
  })
  .onError(({ error, code }) => {
    if (code === 'NOT_FOUND') {
      return;
    }
    err(error);
  })
  // These are as any because type inference in other routers is bugged otherwise
  .use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
  .get('/health', ({ set }) => {
    set.status = 200;
    return {
      status: 'OK',
    };
  })
  .get('/favicon.ico', () => Bun.file(`${RootDirectory}/assets/favicon.ico`))
  .use(jwt(jwtOptions))
  .use(corsPlugin({}))
  .use(timingPlugin({}))
  .get('/previews/*', async ({ params, redirect }) => {
    const file = Bun.file(
      `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/previews/${params['*']}`,
    );
    if (await file.exists()) {
      return file;
    }
    return redirect(`https://kompakkt.de/server/previews/${params['*']}`);
  });

export default configServer;
