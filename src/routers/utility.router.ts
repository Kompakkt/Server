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
        async beforeHandle({ isLoggedIn, status }) {
          if (!isLoggedIn) {
            return status('Forbidden');
          }
          return;
        },
      },
      app =>
        app
          .post(
            '/applyactiontoentityowner',
            ({ status, userdata, body: { command, entityId, ownerUsername } }) =>
              userdata
                ? applyActionToEntityOwner({
                    command,
                    entityId,
                    ownerUsername,
                    userdata,
                  })
                : status('Forbidden'),
            {
              body: t.Object({
                command: t.Enum(Command),
                entityId: t.String(),
                ownerUsername: t.String(),
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
            ({ status, params: { id }, userdata, body: { annotationList } }) =>
              userdata
                ? addAnnotationsToAnnotationList({
                    identifier: id,
                    annotationList,
                    userdata,
                  })
                : status('Forbidden'),
            {
              params: t.Object({
                id: t.String(),
              }),
              body: t.Object({
                annotationList: t.Array(t.String()),
              }),
            },
          )
          .get('/finduseringroups', ({ status, userdata }) =>
            userdata ? findUserInGroups(userdata) : status('Forbidden'),
          )
          .get('/finduserincompilations', ({ status, userdata }) =>
            userdata ? findUserInCompilations(userdata) : status('Forbidden'),
          ),
    ),
);
export default utilityRouter;
