import { Elysia, t } from 'elysia';
import { Collection, ObjectId, type Document } from 'mongodb';
import { randomBytes } from 'node:crypto';
import { UserRank } from 'src/common';
import { Configuration } from 'src/configuration';
import { passwordResetRequest, updatedUserRole } from 'src/mail-templates';
import { sendJSXMail } from 'src/mailer';
import {
  annotationCollection,
  compilationCollection,
  entityCollection,
  userCollection,
  userTokenCollection,
} from 'src/mongo';
import configServer from 'src/server.config';
import { authService, signInBody } from './handlers/auth.service';
import { RESOLVE_FULL_DEPTH, resolveEntity } from './modules/api.v1/resolving-strategies';
import { resolveUsersDataObject } from './modules/user-management/users';
import { exploreCache } from 'src/redis';
import { RouterTags } from './tags';

const gatherDbCollectionStats = async <T extends Document>(collection: Collection<T>) => {
  const items = await collection.find().toArray();
  const creationDates = items.map(item => new ObjectId(item._id).getTimestamp());

  // Yearly stats
  const byYear = creationDates.reduce(
    (acc, item) => {
      const year = item.getFullYear();
      acc[year] = (acc[year] || 0) + 1;
      return acc;
    },
    {} as Record<number, number>,
  );

  // Year to date
  const currentYear = new Date().getFullYear();
  const currentYearCount = byYear[currentYear] || 0;

  // Past month
  const currentMonth = new Date().getMonth();
  const currentMonthCount = creationDates.filter(date => date.getMonth() === currentMonth).length;

  // Past week
  const currentWeek = Math.floor(new Date().getTime() / (7 * 24 * 60 * 60 * 1000));
  const currentWeekCount = creationDates.filter(
    date => Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000)) === currentWeek,
  ).length;

  // Average per year
  const averagePerYear =
    Object.values(byYear).reduce((acc, count) => acc + count, 0) / Object.keys(byYear).length;

  return { byYear, currentYearCount, averagePerYear, currentMonthCount, currentWeekCount };
};

const adminRouter = new Elysia()
  .use(configServer)
  .use(authService)
  .group('/admin', { body: signInBody, isAdmin: true }, group =>
    group
      .post(
        '/digest',
        async ({ query: { from, to, finished, restricted }, status }) => {
          // Check if timespan is larger than 31 days
          if (to - from > 31 * 24 * 60 * 60 * 1000) return status('Bad Request', 'Range too large');

          const entities = await entityCollection
            .find({
              __createdAt: { $gte: from, $lte: to },
              ...(finished !== undefined ? { finished: true } : {}),
              ...(restricted !== undefined ? { online: false } : {}),
            })
            .toArray();
          const resolvedEntities = await Promise.all(entities.map(e => resolveEntity(e, 0)));
          return resolvedEntities;
        },
        {
          query: t.Object({
            from: t.Number(),
            to: t.Number(),
            finished: t.Optional(t.Boolean()),
            restricted: t.Optional(t.Boolean()),
          }),
        },
      )
      .post(
        '/stats',
        async () => {
          const entities = await gatherDbCollectionStats(entityCollection);
          const compilations = await gatherDbCollectionStats(compilationCollection);
          const users = await gatherDbCollectionStats(userCollection);
          const annotations = await gatherDbCollectionStats(annotationCollection);

          return { entities, compilations, users, annotations };
        },
        {
          detail: {
            description: 'Get statistics about the database collections',
            tags: [RouterTags.Admin],
          },
        },
      )
      .post(
        '/getusers',
        async () => {
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
        },
        {
          detail: {
            description: 'Get all users with limited data',
            tags: [RouterTags.Admin],
          },
        },
      )
      .post(
        '/getuser/:identifier',
        async ({ status, params: { identifier } }) => {
          const user = await userCollection.findOne(
            { _id: new ObjectId(identifier) },
            { projection: { sessionID: 0, rank: 0, prename: 0, surname: 0 } },
          );
          if (!user) return status(404);

          const userWithData = resolveUsersDataObject(user);
          return userWithData;
        },
        {
          params: t.Object({
            identifier: t.String(),
          }),
          detail: {
            description: 'Get a specific user by identifier with limited data',
            tags: [RouterTags.Admin],
          },
        },
      )
      .post(
        '/promoteuser',
        async ({ status, body: { identifier, role } }) => {
          const _id = new ObjectId(identifier);

          const user = await userCollection.findOne({ _id });
          if (!user) return status('Not Found');

          const updateResult = await userCollection.updateOne({ _id }, { $set: { role } });
          if (!updateResult) return status('Internal Server Error');

          if (Configuration.Mailer?.Target) {
            sendJSXMail({
              from: Configuration.Mailer.Target.contact,
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
          detail: {
            description: 'Promote a user to a different role',
            tags: [RouterTags.Admin],
          },
        },
      )
      .post(
        '/togglepublished',
        async ({ status, body: { identifier } }) => {
          const _id = new ObjectId(identifier);
          const entity = await entityCollection.findOne({ _id });
          if (!entity) return status('Not Found');

          const isEntityOnline: boolean = !!entity.online;
          const updateResult = await entityCollection.updateOne(
            { _id },
            {
              $set: { online: !isEntityOnline },
            },
          );
          if (!updateResult) return status('Internal Server Error');

          exploreCache.flush();

          return resolveEntity({ _id }, RESOLVE_FULL_DEPTH);
        },
        {
          body: t.Object({
            identifier: t.String(),
          }),
          detail: {
            description: 'Toggle the online/published status of an entity',
            tags: [RouterTags.Admin],
          },
        },
      )
      .post(
        '/resetpassword/:username',
        async ({ status, params: { username } }) => {
          const user = await userCollection.findOne({ username });
          if (!user) return status('Not Found', 'User not found');

          const resetToken = randomBytes(32).toString('hex');
          const tokenExpiration = Date.now() + 86400000; // 24 hours

          const updateResult = await userTokenCollection.updateOne(
            { username },
            { $set: { resetToken, tokenExpiration } },
            { upsert: true },
          );
          if (!updateResult) return status('Internal Server Error');

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
          if (!success) return status('Internal Server Error');

          return { status: 'OK' };
        },
        {
          params: t.Object({
            username: t.String(),
          }),
          detail: {
            description: 'Request a password reset for a user by username',
            tags: [RouterTags.Admin],
          },
        },
      ),
  );

export default adminRouter;
