import corsPlugin from '@elysiajs/cors';
import { type JWTOption, jwt } from '@elysiajs/jwt';
import timingPlugin from '@elysiajs/server-timing';
import { Elysia } from 'elysia';
import { helmet } from 'elysia-helmet';
import { Logestic } from 'logestic';
import { Configuration } from './configuration';
import { RootDirectory } from './environment';
import { err } from './logger';

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
  .onError(({ error, code }) => {
    if (code === 'NOT_FOUND') {
      return;
    }
    err(error);
  })
  // These are as any because type inference in other routers is bugged otherwise
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .use(Logestic.preset('fancy') as any)
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
  .get('/previews/*', ({ params }) =>
    Bun.file(`${RootDirectory}/${Configuration.Uploads.UploadDirectory}/previews/${params['*']}`),
  );

export default configServer;
