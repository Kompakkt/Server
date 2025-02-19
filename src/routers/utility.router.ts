import { Elysia, t } from 'elysia';
import { md5Cache } from 'src/redis';
import configServer from 'src/server.config';
import { authService } from './handlers/auth.service';
import {
  Command,
  addAnnotationsToAnnotationList,
  applyActionToEntityOwner,
  countEntityUses,
  findEntityOwnersQuery,
  findUserInCompilations,
  findUserInGroups,
} from './modules/utility/utility';

const utilityRouter = new Elysia().use(configServer).group('/utility', app =>
  app
    .use(authService)
    .get(
      '/countentityuses/:id',
      async ({ params: { id }, userdata }) => countEntityUses(id, userdata),
      {
        params: t.Object({
          id: t.String(),
        }),
      },
    )
    .guard(
      {
        async beforeHandle(context) {
          if (!context.isLoggedIn) {
            return context.error('Forbidden');
          }
          return;
        },
      },
      app =>
        app
          .post(
            '/applyactiontoentityowner',
            ({ error, userdata, params: { command, entityId, otherUsername } }) =>
              userdata
                ? applyActionToEntityOwner({
                    command,
                    entityId,
                    otherUsername,
                    userdata,
                  })
                : error('Forbidden'),
            {
              params: t.Object({
                command: t.Enum(Command),
                entityId: t.String(),
                otherUsername: t.String(),
              }),
            },
          )
          .post(
            '/checksumexists',
            async ({ body: { checksum } }) => {
              const existing = await md5Cache.get<string>(checksum);
              return { checksum, existing };
            },
            {
              body: t.Object({
                checksum: t.String(),
              }),
            },
          )
          .get('/findentityowners/:id', ({ params: { id } }) => findEntityOwnersQuery(id), {
            params: t.Object({
              id: t.String(),
            }),
          })
          .post(
            '/moveannotations/:id',
            ({ error, params: { id }, userdata, body: { annotationList } }) =>
              userdata
                ? addAnnotationsToAnnotationList({
                    identifier: id,
                    annotationList,
                    userdata,
                  })
                : error('Forbidden'),
            {
              params: t.Object({
                id: t.String(),
              }),
              body: t.Object({
                annotationList: t.Array(t.String()),
              }),
            },
          )
          .get('/finduseringroups', ({ error, userdata }) =>
            userdata ? findUserInGroups(userdata) : error('Forbidden'),
          )
          .get('/finduserincompilations', ({ error, userdata }) =>
            userdata ? findUserInCompilations(userdata) : error('Forbidden'),
          ),
    ),
);
export default utilityRouter;
