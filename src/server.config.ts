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
  .use(jwt(jwtOptions))
  .use(corsPlugin())
  .use(timingPlugin());

export default configServer;
