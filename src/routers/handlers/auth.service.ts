import jwt from '@elysiajs/jwt';
import Elysia, { t, type Static } from 'elysia';
import { ObjectId } from 'mongodb';
import { AuthController } from 'src/authentication';
import { UserRank } from 'src/common';
import { userCollection } from 'src/mongo';
import configServer, { jwtOptions } from 'src/server.config';

export const signInBody = t.Object({
  username: t.String(),
  password: t.String(),
});
type SignInBody = Static<typeof signInBody>;

export const strategyParams = t.Object({
  strategy: t.Optional(t.String()),
});

export const authService = new Elysia({ name: 'Service.Auth' })
  .use(configServer)
  .use(jwt(jwtOptions))
  .resolve({ as: 'global' }, async ({ jwt, cookie }) => {
    const result = await jwt.verify(cookie.auth.value);
    if (!result) {
      return { userdata: undefined, isLoggedIn: false, isAdmin: false };
    }
    const { username, _id } = result as { username: string; _id: string };
    const user = await userCollection.findOne({ username, _id: new ObjectId(_id) });
    if (!user) {
      return { userdata: undefined, isLoggedIn: false, isAdmin: false };
    }
    return { userdata: user, isLoggedIn: true, isAdmin: user.role === UserRank.admin };
  })
  .decorate('useAuthController', async (body: SignInBody, strategy?: string) => {
    const wrappedUserdata = await (async () => {
      switch (strategy) {
        case 'ldap':
        case 'uni-cologne-ldap':
          return AuthController.authenticate('UniCologneLDAPStrategy', body);
        default:
          return AuthController.authenticateAnyWithUsernamePassword(body);
      }
    })();
    return wrappedUserdata;
  })
  .macro(({ onBeforeHandle }) => ({
    isLoggedIn(needed?: boolean) {
      if (!needed) return;
      onBeforeHandle(({ error, userdata }) => {
        if (!userdata) return error('Forbidden');
        return;
      });
    },
    isAdmin(needed?: boolean) {
      if (!needed) return;
      onBeforeHandle(({ error, userdata }) => {
        if (userdata?.role !== UserRank.admin) return error('Forbidden');
        return;
      });
    },
    verifyLoginData(needed?: boolean) {
      if (!needed) return;
      onBeforeHandle(async ({ error, body, params, useAuthController }) => {
        const loginBody = body as SignInBody;
        if (!loginBody?.username || !loginBody?.password) return error('Forbidden');

        // TODO: maybe params can be typed as part of onBeforeHandle
        const typedParams = params as Static<typeof strategyParams>;
        const strategy = typedParams.strategy;

        const authResult = await useAuthController(loginBody, strategy);
        if (authResult instanceof Error) return error('Forbidden');
        return;
      });
    },
  }));
