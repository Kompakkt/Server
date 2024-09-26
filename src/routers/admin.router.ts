import { randomBytes } from 'crypto';
import { Elysia, t } from 'elysia';
import { ObjectId } from 'mongodb';
import { UserRank } from 'src/common';
import { Configuration } from 'src/configuration';
import { passwordResetRequest, updatedUserRole } from 'src/mail-templates';
import { sendJSXMail } from 'src/mailer';
import { entityCollection, userCollection, userTokenCollection } from 'src/mongo';
import configServer from 'src/server.config';
import { resolveEntity } from './modules/api.v1/resolving-strategies';
import { resolveUsersDataObject } from './modules/user-management/users';
import { authService, signInBody } from './handlers/auth.service';

const adminRouter = new Elysia()
  .use(configServer)
  .use(authService)
  .group('/admin', { body: signInBody, isAdmin: true }, group =>
    group
      .post('/getusers', async ({ error }) => {
        const allAccounts = await userCollection
          .find(
            {},
            {
              projection: {
                sessionID: 0,
                rank: 0,
                prename: 0,
                surname: 0,
              },
            },
          )
          .toArray();
        return allAccounts;
      })
      .post(
        '/getuser/:identifier',
        async ({ error, params: { identifier } }) => {
          const user = await userCollection.findOne(
            { _id: new ObjectId(identifier) },
            { projection: { sessionID: 0, rank: 0, prename: 0, surname: 0 } },
          );
          if (!user) return error(404);

          const userWithData = resolveUsersDataObject(user);
          return userWithData;
        },
        {
          params: t.Object({
            identifier: t.String(),
          }),
        },
      )
      .post(
        '/promoteuser',
        async ({ error, body: { identifier, role } }) => {
          const _id = new ObjectId(identifier);

          const user = await userCollection.findOne({ _id });
          if (!user) return error('Not Found');

          const updateResult = await userCollection.updateOne({ _id }, { $set: { role } });
          if (!updateResult) return error('Internal Server Error');

          if (Configuration.Mailer && Configuration.Mailer.Target) {
            sendJSXMail({
              from: Configuration.Mailer.Target['contact'],
              to: user.mail,
              subject: 'Your Kompakkt status has been updated',
              jsx: updatedUserRole({
                prename: user.prename,
                prevRole: user.role,
                newRole: role,
              }),
            });
          }

          return { status: 'OK' };
        },
        {
          body: t.Object({
            identifier: t.String(),
            role: t.Enum(UserRank),
          }),
        },
      )
      .post(
        '/togglepublished',
        async ({ error, body: { identifier } }) => {
          const _id = new ObjectId(identifier);
          const entity = await entityCollection.findOne({ _id });
          if (!entity) return error('Not Found');

          const isEntityOnline: boolean = !!entity.online;
          const updateResult = await entityCollection.updateOne(
            { _id },
            {
              $set: { online: !isEntityOnline },
            },
          );
          if (!updateResult) return error('Internal Server Error');
          return resolveEntity({ _id });
        },
        {
          body: t.Object({
            identifier: t.String(),
          }),
        },
      )
      .post(
        '/resetpassword/:username',
        async ({ error, params: { username } }) => {
          const user = await userCollection.findOne({ username });
          if (!user) return error('Not Found', 'User not found');

          const resetToken = randomBytes(32).toString('hex');
          const tokenExpiration = Date.now() + 86400000; // 24 hours

          const updateResult = await userTokenCollection.updateOne(
            { username },
            { $set: { resetToken, tokenExpiration } },
            { upsert: true },
          );
          if (!updateResult) return error('Internal Server Error');

          const success = await sendJSXMail({
            from: Configuration.Mailer?.Target?.contact ?? 'noreply@kompakkt.de',
            to: user.mail,
            subject: 'Kompakkt password reset request',
            jsx: passwordResetRequest({
              prename: user.prename,
              resetToken,
              requestedByAdministrator: true,
            }),
          });
          if (!success) return error('Internal Server Error');

          return { status: 'OK' };
        },
        {
          params: t.Object({
            username: t.String(),
          }),
        },
      ),
  );

export default adminRouter;
