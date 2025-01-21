import { randomBytes } from 'crypto';
import { Elysia, t } from 'elysia';
import { ObjectId } from 'mongodb';
import { UserRank, type IUserData } from 'src/common';
import { sendJSXMail } from 'src/mailer';
import { userCollection, userTokenCollection } from 'src/mongo';
import configServer from 'src/server.config';
import { updateUserPassword } from 'src/util/authentication-helpers';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import { forgotUsername, passwordResetRequest, welcomeNewAccount } from '../mail-templates';
import { resolveUsersDataObject } from './modules/user-management/users';
import { authService, signInBody } from './handlers/auth.service';

const userManagementRouter = new Elysia()
  .use(configServer)
  .use(authService)
  .group('/user-management', app =>
    app
      .post(
        '/login/:strategy?',
        async ({ params: { strategy }, body, error, cookie: { auth }, jwt, useAuthController }) => {
          const userdata = await useAuthController(body, strategy);
          if (userdata instanceof Error) {
            return error(401, userdata);
          }

          auth.set({
            value: await jwt.sign({ username: userdata.username, _id: userdata._id.toString() }),
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
          });

          return userdata;
        },
        {
          params: t.Object({
            strategy: t.Optional(t.String()),
          }),
          body: signInBody,
        },
      )
      .post(
        '/register',
        async ({ error, body, set }) => {
          // First user gets admin
          const isFirstUser = (await userCollection.findOne({})) === undefined;
          const role = isFirstUser ? UserRank.admin : UserRank.uploader;

          const { username, password } = body;
          const existingFindResult = await userCollection.findOne({ username });
          if (existingFindResult !== null) {
            return error(409, 'User already exists');
          }

          const { prename, surname, mail, fullname } = body;
          const adjustedUser: ServerDocument<IUserData> = {
            username,
            prename,
            surname,
            mail,
            fullname,
            role,
            data: {},
            _id: new ObjectId(),
            sessionID: '',
          };

          const transactionResult = await Promise.allSettled([
            updateUserPassword(username, password),
            userCollection.insertOne(adjustedUser),
          ]).then(results => results.every(result => result.status === 'fulfilled'));

          if (!transactionResult) {
            return error(500, 'Failed creating user');
          }

          const success = await sendJSXMail({
            from: 'noreply@kompakkt.de',
            to: mail,
            subject: 'Welcome to Kompakkt!',
            jsx: welcomeNewAccount(adjustedUser),
          });
          if (!success) return error(500, 'Failed sending welcome mail');

          return adjustedUser;
        },
        {
          body: t.Object({
            username: t.String(),
            password: t.String(),
            mail: t.String(),
            prename: t.String(),
            surname: t.String(),
            fullname: t.String(),
          }),
        },
      )
      .get(
        '/logout',
        ({ error, cookie: { auth }, set }) => {
          if (!auth.value) {
            return error(401, 'No session');
          }
          auth.set({ value: '', path: '/', sameSite: 'lax', maxAge: 0, expires: new Date(0) });
          set.headers['Set-Cookie'] = 'auth=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
          return { status: 'OK' };
        },
        {
          isLoggedIn: true,
        },
      )
      .get('/auth', async ({ cookie: { auth }, error, jwt, set }) => {
        if (!auth.value) {
          return error(401, 'No session');
        }
        const result = await jwt.verify(auth.value);
        if (!result) {
          return error(401, 'Invalid session');
        }
        const { username, _id } = result;
        if (!username || typeof username !== 'string' || !_id || typeof _id !== 'string') {
          return error(401, 'Invalid session');
        }
        const user = await userCollection.findOne({ username, _id: new ObjectId(_id) });
        if (!user) {
          return error(401, 'User not found');
        }

        const userWithData = resolveUsersDataObject(user);
        return userWithData;
      })
      .post(
        '/help/request-reset',
        async ({ error, body: { username } }) => {
          const user = await userCollection.findOne({ username });
          if (!user) return error('Not Found');

          const resetToken = randomBytes(32).toString('hex');
          const tokenExpiration = Date.now() + 86400000; // 24 hours

          const updateResult = await userTokenCollection.updateOne(
            { username },
            {
              $set: { resetToken, tokenExpiration },
            },
            { upsert: true },
          );
          if (!updateResult) return error('Internal Server Error');

          const success = await sendJSXMail({
            from: 'noreply@kompakkt.de',
            to: user.mail,
            subject: 'Kompakkt password reset request',
            jsx: passwordResetRequest({ prename: user.prename, resetToken }),
          });
          if (!success) return error('Internal Server Error');

          return { status: 'OK' };
        },
        {
          body: t.Object({
            username: t.String(),
          }),
        },
      )
      .post(
        '/help/confirm-reset',
        async ({ error, body: { username, token, password } }) => {
          const user = await userCollection.findOne({ username });
          if (!user) return error(400);
          const userToken = await userTokenCollection.findOne({ username });
          if (!userToken) return error(400);

          const { resetToken, tokenExpiration } = userToken;

          if (
            !tokenExpiration ||
            !resetToken ||
            tokenExpiration < Date.now() ||
            resetToken !== token
          )
            return error(500);

          // Remove token
          const updateResult = await userTokenCollection.updateOne(
            { username },
            {
              $unset: { resetToken: '', tokenExpiration: '' },
            },
          );
          if (!updateResult) return error(500);

          // Update password
          const success = await updateUserPassword(user.username, password);
          if (!success) return error(500);

          return { status: 'OK' };
        },
        {
          body: t.Object({
            username: t.String(),
            token: t.String(),
            password: t.String(),
          }),
        },
      )
      .post(
        '/help/forgot-username',
        async ({ error, body: { mail } }) => {
          const user = await userCollection.findOne({ mail });
          if (!user) return error(400);

          const success = await sendJSXMail({
            from: 'noreply@kompakkt.de',
            to: user.mail,
            subject: 'Your Kompakkt username',
            jsx: forgotUsername(user),
          });
          if (!success) return error(500);

          return { status: 'OK' };
        },
        {
          body: t.Object({
            mail: t.String(),
          }),
        },
      ),
  );

export default userManagementRouter;
