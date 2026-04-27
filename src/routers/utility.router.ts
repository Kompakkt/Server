import { Elysia, t } from 'elysia';
import { ObjectId } from 'mongodb';
import { mkdir } from 'node:fs/promises';
import { Configuration } from 'src/configuration';
import { RootDirectory } from 'src/environment';
import { entityCollection } from 'src/mongo';
import configServer from 'src/server.config';
import { authService } from './handlers/auth.service';
import { addAnnotationsToAnnotationList, countEntityUses } from './modules/utility/utility';
import { checkIsOwner } from './modules/user-management/users';
import { Collection, EntityAccessRole, UserRank } from '@kompakkt/common';

const utilityRouter = new Elysia().use(configServer).group('/utility', app =>
  app
    .use(authService)
    .get('/countentityuses/:id', async ({ params: { id } }) => countEntityUses(id), {
      params: t.Object({ id: t.String() }),
    })
    .post(
      '/generate-entity-video-preview',
      async ({ body: { entityId, screenshots }, status, userdata }) => {
        if (!userdata) return status('Forbidden');
        const entity = await entityCollection.findOne({ _id: new ObjectId(entityId) });
        if (!entity) return status('Not Found', 'Entity not found');

        const hasAccess = await (async () => {
          const currentAccess = entity.access.find(user => user._id === userdata._id.toString());
          const isOwner = await checkIsOwner({
            doc: entity,
            collection: Collection.entity,
            userdata,
          });

          const isAdmin = userdata.role === UserRank.admin;

          return (
            currentAccess?.role === EntityAccessRole.owner ||
            currentAccess?.role === EntityAccessRole.editor ||
            isOwner ||
            isAdmin
          );
        })();

        if (!hasAccess) return status(403);

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
        isLoggedIn: true,
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
            '/checksumexists',
            async ({ body: { checksum } }) => {
              // TODO: Deprecate endpoint, keeping until removed from frontend
              // const existing = await md5Cache.get<string>(checksum).catch(() => undefined);
              return { checksum, existing: false };
            },
            { body: t.Object({ checksum: t.String() }) },
          )
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
          ),
    ),
);
export default utilityRouter;
