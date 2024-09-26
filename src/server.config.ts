import corsPlugin from '@elysiajs/cors';
import { jwt, type JWTOption } from '@elysiajs/jwt';
import timingPlugin from '@elysiajs/server-timing';
import { swagger } from '@elysiajs/swagger';
import { Elysia } from 'elysia';
import { helmet } from 'elysia-helmet';
import { Logestic } from 'logestic';
import { Configuration } from './configuration';
import { RootDirectory } from './environment';

export const jwtOptions: JWTOption = {
  secret: Bun.env['JWT_SECRET'] ?? 'secret',
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
    console.error(error);
  })
  .use(Logestic.preset('fancy'))
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
    }),
  )
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
  .use(jwt(jwtOptions))
  .use(corsPlugin({}))
  .use(timingPlugin({}))
  .get(
    '/previews/*',
    ({ redirect, params }) =>
      Bun.file(`${RootDirectory}/${Configuration.Uploads.UploadDirectory}/previews/${params['*']}`),
    // redirect(`https://kompakkt.de/server/previews/${params['*']}`),
  );

export default configServer;
