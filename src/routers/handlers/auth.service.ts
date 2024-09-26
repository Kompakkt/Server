import jwt from '@elysiajs/jwt';
import Elysia, { t, type Static } from 'elysia';
import { ObjectId } from 'mongodb';
import { UserRank } from 'src/common';
import { userCollection } from 'src/mongo';
import configServer, { jwtOptions } from 'src/server.config';

export const signInBody = t.Object({
  username: t.String(),
  password: t.String(),
});
type SignInBody = Static<typeof signInBody>;

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
  .macro(({ onBeforeHandle }) => ({
    // This is declaring a service method
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
      onBeforeHandle(({ error, body }) => {
        const loginBody = body as SignInBody;
        if (!loginBody?.username || !loginBody?.password) return error('Forbidden');
        // TODO: Verify login
        return;
      });
    },
  }));
