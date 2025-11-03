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
import { copyFile, mkdir, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { entityCollection } from 'src/mongo';
import { ObjectId } from 'mongodb';
import { RootDirectory } from 'src/environment';
import { Configuration } from 'src/configuration';
import sharp from 'sharp';

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

        const tmpDir = await mkdtemp(join(tmpdir(), 'bun-'));

        await Promise.all(
          screenshots.map((screenshot, index) => {
            const buffer = Buffer.from(
              screenshot.replace(/^data:image\/\w+;base64,/, ''),
              'base64',
            );
            return sharp(buffer)
              .png()
              .toFile(`${tmpDir}/frame_${String(index).padStart(4, '0')}.png`);
          }),
        );

        await Bun.$`ffmpeg -y -framerate ${screenshots.length} -i ${tmpDir}/frame_%04d.png -c:v libvpx-vp9 -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -deadline best -crf 30 -b:v 200k -g 1 ${tmpDir}/${entityId}.webm`.quiet();

        const previewPath = `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/previews/${mediaType}/`;
        await mkdir(previewPath, { recursive: true });
        await copyFile(`${tmpDir}/${entityId}.webm`, `${previewPath}${entityId}.webm`);

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
              const existing = await md5Cache.get<string>(checksum).catch(() => undefined);
              return { checksum, existing };
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
          .get('/finduseringroups', ({ status, userdata }) =>
            userdata ? findUserInGroups(userdata) : status('Forbidden'),
          )
          .get('/finduserincompilations', ({ status, userdata }) =>
            userdata ? findUserInCompilations(userdata) : status('Forbidden'),
          ),
    ),
);
export default utilityRouter;
