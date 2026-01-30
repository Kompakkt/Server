import { Elysia, t } from 'elysia';
import { ObjectId } from 'mongodb';
import { randomBytes } from 'node:crypto';
import { type IUserData, UserRank } from 'src/common';
import { info, warn } from 'src/logger';
import { sendReactMail } from 'src/mailer';
import { userCollection, userTokenCollection } from 'src/mongo';
import configServer from 'src/server.config';
import { updateUserPassword } from 'src/util/authentication-helpers';
import type { ServerDocument } from 'src/util/document-with-objectid-type';
import {
  forgotUsernameTemplate,
  passwordResetRequestTemplate,
  welcomeNewAccountTemplate,
} from '../emails';
import { authService, signInBody } from './handlers/auth.service';
import { getMailDomainFromPublicURL } from 'src/util/get-mail-domain';

const userManagementRouter = new Elysia()
  .use(configServer)
  .use(authService)
  .group('/user-management', app =>
    app
      .post(
        '/login/:strategy?',
        async ({
          params: { strategy },
          body,
          status,
          cookie: { auth },
          jwt,
          useAuthController,
          request,
          set: { headers },
        }) => {
          const userdata = await useAuthController(body, strategy);
          if (userdata instanceof Error) {
            return status(401, userdata);
          }

          const origin = request.headers.get('origin') ?? '';
          const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');

          const token = await jwt.sign({
            username: userdata.username,
            _id: userdata._id.toString(),
          });
          auth.set({
            value: token,
            path: '/',
            httpOnly: true,
            sameSite: isLocalhost ? 'none' : 'lax',
            secure: isLocalhost ? true : undefined,
          });
          headers['x-jwt'] = token;
          if (headers['access-control-expose-headers'] === undefined) {
            headers['access-control-expose-headers'] = 'x-jwt';
          } else {
            headers['access-control-expose-headers'] += ', x-jwt';
          }

          return userdata;
        },
        { params: t.Object({ strategy: t.Optional(t.String()) }), body: signInBody },
      )
      .post(
        '/register',
        async ({ status, body }) => {
          info('Registering new user');
          // First user gets admin
          const isFirstUser = (await userCollection.findOne({})) === undefined;
          const role = isFirstUser ? UserRank.admin : UserRank.uploader;

          const { username, password } = body;
          const existingFindResult = await userCollection.findOne({ username });
          if (existingFindResult !== null) {
            return status(409, 'User already exists');
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

          info('Creating user', adjustedUser);
          const transactionResult = await Promise.allSettled([
            updateUserPassword(username, password),
            userCollection.insertOne(adjustedUser),
          ]).then(results => results.every(result => result.status === 'fulfilled'));

          if (!transactionResult) {
            return status(500, 'Failed creating user');
          }

          info('Sending welcome mail');
          const success = await sendReactMail({
            from: `noreply@${getMailDomainFromPublicURL()}`,
            to: mail,
            subject: 'Welcome to Kompakkt!',
            jsx: welcomeNewAccountTemplate(adjustedUser),
          });
          if (!success) return status(500, 'Failed sending welcome mail');

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
        ({ status, cookie: { auth }, set }) => {
          if (!auth.value) {
            return status(401, 'No session');
          }
          auth.set({ value: '', path: '/', sameSite: 'lax', maxAge: 0, expires: new Date(0) });
          set.headers['Set-Cookie'] = 'auth=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
          return { status: 'OK' };
        },
        { isLoggedIn: true },
      )
      .get('/auth', async ({ userdata, status, extractedJwt, set: { headers } }) => {
        if (!userdata || !extractedJwt) {
          return status(401, 'User not found');
        }

        headers['x-jwt'] = extractedJwt;
        if (headers['access-control-expose-headers'] === undefined) {
          headers['access-control-expose-headers'] = 'x-jwt';
        } else {
          headers['access-control-expose-headers'] += ', x-jwt';
        }

        // As IUserDataWithoutData
        const user = { ...userdata };
        delete (user as any).data;
        return user;
      })
      .post(
        '/help/request-reset',
        async ({ status, body: { username } }) => {
          try {
            const user = await userCollection.findOne({ username });
            if (!user) return status('Not Found');

            const resetToken = randomBytes(32).toString('hex');
            const tokenExpiration = Date.now() + 86400000; // 24 hours

            const updateResult = await userTokenCollection.updateOne(
              { username },
              { $set: { resetToken, tokenExpiration } },
              { upsert: true },
            );
            if (!updateResult) return status('Internal Server Error');

            const success = await sendReactMail({
              from: `noreply@${getMailDomainFromPublicURL()}`,
              to: user.mail,
              subject: 'Kompakkt password reset request',
              jsx: passwordResetRequestTemplate({ prename: user.prename, resetToken }),
            });
            if (!success) return status('Internal Server Error');

            return { status: 'OK' };
          } catch (error) {
            warn('Error in /help/request-reset:', error);
            return status(500, 'Internal Server Error');
          }
        },
        {
          body: t.Object({
            username: t.String(),
          }),
        },
      )
      .post(
        '/help/confirm-reset',
        async ({ status, body: { username, token, password } }) => {
          const user = await userCollection.findOne({ username });
          if (!user) return status(400);
          const userToken = await userTokenCollection.findOne({ username });
          if (!userToken) return status(400);

          const { resetToken, tokenExpiration } = userToken;

          if (
            !tokenExpiration ||
            !resetToken ||
            tokenExpiration < Date.now() ||
            resetToken !== token
          )
            return status(500);

          // Remove token
          const updateResult = await userTokenCollection.updateOne(
            { username },
            {
              $unset: { resetToken: '', tokenExpiration: '' },
            },
          );
          if (!updateResult) return status(500);

          // Update password
          const success = await updateUserPassword(user.username, password);
          if (!success) return status(500);

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
        async ({ status, body: { mail } }) => {
          const user = await userCollection.findOne({ mail });
          if (!user) return status(400);

          const success = await sendReactMail({
            from: `noreply@${getMailDomainFromPublicURL()}`,
            to: user.mail,
            subject: 'Your Kompakkt username',
            jsx: forgotUsernameTemplate(user),
          });
          if (!success) return status(500);

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
