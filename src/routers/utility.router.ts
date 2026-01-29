import { Elysia, t } from 'elysia';
import { ObjectId } from 'mongodb';
import { mkdir } from 'node:fs/promises';
import { Configuration } from 'src/configuration';
import { RootDirectory } from 'src/environment';
import { entityCollection } from 'src/mongo';
import configServer from 'src/server.config';
import { authService } from './handlers/auth.service';
import {
  Command,
  addAnnotationsToAnnotationList,
  applyActionToEntityOwner,
  countEntityUses,
  findEntityOwnersQuery,
  findUserInCompilations,
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
    .post(
      '/generate-entity-video-preview',
      async ({ body: { entityId, screenshots }, status }) => {
        const entity = await entityCollection.findOne({ _id: new ObjectId(entityId) });
        if (!entity) return status('Not Found', 'Entity not found');

        const mediaType =
          {
            model: 'entity',
            cloud: 'entity',
            splat: 'entity',
          }[entity.mediaType] ?? entity.mediaType;

        const port = Bun.env.PREVIEW_GEN_PORT ? parseInt(Bun.env.PREVIEW_GEN_PORT) : 14841;
        const webmBuffer = await Bun.fetch(`http://preview-gen:${port}/generate-preview-video`, {
          method: 'POST',
          body: JSON.stringify({ screenshots, entityId }),
          headers: {
            'Content-Type': 'application/json',
          },
        }).then(response => response.arrayBuffer());

        const previewPath = `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/previews/${mediaType}/`;
        await mkdir(previewPath, { recursive: true });
        await Bun.write(`${previewPath}${entityId}.webm`, webmBuffer);

        const finalPath = `/server/previews/${mediaType}/${entityId}.webm`;
        await entityCollection.updateOne(
          { _id: new ObjectId(entityId) },
          { $set: { 'settings.previewVideo': finalPath } },
        );

        return { status: 'OK', videoUrl: finalPath };
      },
      {
        body: t.Object({
          screenshots: t.Array(t.String()),
          entityId: t.String(),
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
              // TODO: Deprecate endpoint, keeping until removed from frontend
              // const existing = await md5Cache.get<string>(checksum).catch(() => undefined);
              return { checksum, existing: false };
            },
            { body: t.Object({ checksum: t.String() }) },
          )
          .get('/findentityowners/:id', ({ params: { id } }) => findEntityOwnersQuery(id), {
            params: t.Object({ id: t.String() }),
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
              params: t.Object({ id: t.String() }),
              body: t.Object({ annotationList: t.Array(t.String()) }),
            },
          )
          .get('/finduserincompilations', ({ status, userdata }) =>
            userdata ? findUserInCompilations(userdata) : status('Forbidden'),
          ),
    ),
);
export default utilityRouter;
