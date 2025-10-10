import jwt from '@elysiajs/jwt';
import Elysia, { t, type Static } from 'elysia';
import { ObjectId } from 'mongodb';
import { AuthController } from 'src/authentication';
import { UserRank, type IUserData } from 'src/common';
import { log } from 'src/logger';
import { userCollection } from 'src/mongo';
import configServer, { jwtOptions } from 'src/server.config';
import type { ServerDocument } from 'src/util/document-with-objectid-type';

export const signInBody = t.Object({
  username: t.String(),
  password: t.String(),
});
export type SignInBody = Static<typeof signInBody>;
export const isSignInBody = (data: unknown): data is SignInBody => {
  return (
    typeof data === 'object' &&
    data !== null &&
    'username' in data &&
    'password' in data &&
    typeof data.username === 'string' &&
    typeof data.password === 'string'
  );
};

export const strategyParams = t.Optional(
  t.Object({
    strategy: t.String(),
  }),
);
export type StrategyParams = Static<typeof strategyParams>;
export const isStrategyParams = (data: unknown): data is StrategyParams => {
  return (
    typeof data === 'object' &&
    data !== null &&
    'strategy' in data &&
    (typeof data.strategy === 'string' || data.strategy === undefined)
  );
};

export const authService = new Elysia({ name: 'authService' })
  .use(configServer)
  .use(jwt(jwtOptions))
  .resolve(
    { as: 'global' },
    async ({
      jwt,
      cookie: { auth },
      headers: { authorization },
    }): Promise<{
      userdata: ServerDocument<IUserData> | undefined;
      isLoggedIn: boolean;
      isAdmin: boolean;
    }> => {
      const result = await (async () => {
        const token = authorization?.replace('Bearer ', '')?.trim();
        if (token) return await jwt.verify(token);
        return await jwt.verify(auth.value as any);
      })();
      if (!result) {
        return { userdata: undefined, isLoggedIn: false, isAdmin: false };
      }
      const { username, _id } = result as { username: string; _id: string };
      const user = await userCollection.findOne({ username, _id: new ObjectId(_id) });
      if (!user) {
        return { userdata: undefined, isLoggedIn: false, isAdmin: false };
      }
      return { userdata: user, isLoggedIn: true, isAdmin: user.role === UserRank.admin };
    },
  )
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
  .macro({
    isLoggedIn: {
      resolve: ({ status, userdata }) => {
        if (!userdata) return status('Forbidden');
        return;
      },
    },
    isAdmin: {
      resolve: ({ status, userdata }) => {
        if (userdata?.role !== UserRank.admin) return status('Forbidden');
        return;
      },
    },
    verifyLoginData: {
      // TODO: These are bugged due to: https://github.com/elysiajs/elysia/issues/1282
      // body: signInBody,
      // params: strategyParams,
      resolve: async ({ status, body, params, useAuthController }) => {
        if (!isSignInBody(body)) return status('Forbidden');
        if (!body?.username || !body?.password) return status('Forbidden');
        const strategy =
          'strategy' in params && typeof params.strategy === 'string' ? params.strategy : undefined;

        const authResult = await useAuthController(body, strategy);
        if (authResult instanceof Error) {
          log(`Failed login attempt for user ${body.username} using strategy ${strategy}`);
          return status('Forbidden');
        }
        return;
      },
    },
  });
