import { Elysia, t } from 'elysia';
import { ObjectId } from 'mongodb';
import { randomBytes } from 'node:crypto';
import {
  type IUserData,
  IUserDataSchema,
  IUserDataWithoutDataSchema,
  UserRank,
} from '@kompakkt/common';
import { info, warn } from 'src/logger';
import { sendReactMail } from 'src/mailer';
import { type AuthUser, userCollection, userTokenCollection } from 'src/mongo';
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
import { createNewUserProfile } from 'src/util/create-new-user-profile';
import { RouterTags } from './tags';

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
            tokenVersion: (userdata as AuthUser).tokenVersion ?? 0,
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
        {
          params: t.Object({ strategy: t.Optional(t.String()) }),
          response: {
            200: IUserDataSchema,
            401: t.Any(),
          },
          body: signInBody,
          detail: {
            description:
              'Endpoint to log in a user using the specified strategy. Returns user data upon successful authentication.',
            tags: [RouterTags['User Management']],
          },
        },
      )
      .post(
        '/register',
        async ({ status, body }) => {
          info('Registering new user');
          // First user gets admin
          const isFirstUser = (await userCollection.countDocuments()) === 0;
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
            strategy: 'local',
            profiles: [],
          };

          const userProfile = await createNewUserProfile(adjustedUser).catch(err => {
            warn('Error creating user profile for new user:', err);
            return null;
          });
          if (!userProfile) {
            return status(500, 'Failed creating user profile');
          }
          adjustedUser.profiles.push(userProfile);

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
          response: {
            200: IUserDataSchema,
            409: t.Any(),
            500: t.Any(),
          },
          detail: {
            description:
              'Endpoint to register a new user. The first ever registered user gets admin privileges. A welcome email is sent upon successful registration.',
            tags: [RouterTags['User Management']],
          },
        },
      )
      .get(
        '/logout',
        async ({ status, userdata, cookie: { auth }, set }) => {
          if (!userdata) return status(401, 'No session');
          const result = await userCollection.updateOne(
            { _id: userdata._id },
            { $inc: { tokenVersion: 1 } },
          );
          if (!result.modifiedCount) return status(500, 'Logout failed');
          auth.set({ value: '', path: '/', sameSite: 'lax', maxAge: 0, expires: new Date(0) });
          set.headers['Set-Cookie'] = 'auth=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
          return { status: 'OK' };
        },
        {
          isLoggedIn: true,
          response: { 200: t.Object({ status: t.Literal('OK') }), 401: t.Any(), 500: t.Any() },
          detail: {
            description:
              'Endpoint to log out the user. Invalidates all tokens for this user across all devices.',
            tags: [RouterTags['User Management']],
          },
        },
      )
      .get(
        '/auth',
        async ({ userdata, status, extractedJwt, set: { headers } }) => {
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
        },
        {
          response: {
            200: IUserDataWithoutDataSchema,
            401: t.Any(),
          },
          detail: {
            description:
              'Endpoint to check if the user is authenticated and retrieve their user data.',
            tags: [RouterTags['User Management']],
          },
        },
      )
      .post(
        '/help/request-reset',
        async ({ status, body: { username } }) => {
          try {
            const user = await userCollection.findOne({ username });
            if (!user) return status(404, 'Not Found');

            const resetToken = randomBytes(32).toString('hex');
            const tokenExpiration = Date.now() + 86400000; // 24 hours

            const updateResult = await userTokenCollection.updateOne(
              { username },
              { $set: { resetToken, tokenExpiration } },
              { upsert: true },
            );
            if (!updateResult) return status(500, 'Internal Server Error');

            const success = await sendReactMail({
              from: `noreply@${getMailDomainFromPublicURL()}`,
              to: user.mail,
              subject: 'Kompakkt password reset request',
              jsx: passwordResetRequestTemplate({ prename: user.prename, resetToken }),
            });
            if (!success) return status(500, 'Internal Server Error');

            return { status: 'OK' };
          } catch (error) {
            warn('Error in /help/request-reset:', error);
            return status(500, 'Internal Server Error');
          }
        },
        {
          response: {
            200: t.Object({ status: t.Literal('OK') }),
            404: t.Any(),
            500: t.Any(),
          },
          body: t.Object({
            username: t.String(),
          }),
          detail: {
            description:
              'Endpoint to request a password reset, which generates a token and sends it via email to the user.',
            tags: [RouterTags['User Management']],
          },
        },
      )
      .post(
        '/help/confirm-reset',
        async ({ status, body: { username, token, password } }) => {
          const user = await userCollection.findOne({ username });
          if (!user) return status(400, 'Invalid username');
          const userToken = await userTokenCollection.findOne({ username });
          if (!userToken) return status(400, 'No reset request found');

          const { resetToken, tokenExpiration } = userToken;

          if (
            !tokenExpiration ||
            !resetToken ||
            tokenExpiration < Date.now() ||
            resetToken !== token
          )
            return status(400, 'Invalid or expired token');

          // Remove token
          const updateResult = await userTokenCollection.updateOne(
            { username },
            {
              $unset: { resetToken: '', tokenExpiration: '' },
            },
          );
          if (!updateResult) return status(500, 'Internal Server Error');

          // Update password
          const success = await updateUserPassword(user.username, password);
          if (!success) return status(500, 'Internal Server Error');

          const incResult = await userCollection.updateOne(
            { _id: user._id },
            { $inc: { tokenVersion: 1 } },
          );
          if (!incResult.modifiedCount) return status(500, 'Internal Server Error');

          return { status: 'OK' };
        },
        {
          response: {
            200: t.Object({ status: t.Literal('OK') }),
            400: t.Any(),
            500: t.Any(),
          },
          body: t.Object({
            username: t.String(),
            token: t.String(),
            password: t.String(),
          }),
          detail: {
            description:
              'Endpoint to confirm a password reset request using a token sent via email.',
            tags: [RouterTags['User Management']],
          },
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
          detail: {
            description:
              'Endpoint to request a reminder of the username associated with an email address.',
            tags: [RouterTags['User Management']],
          },
        },
      ),
  );

export default userManagementRouter;
