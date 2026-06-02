import Elysia, { t } from 'elysia';
import configServer from 'src/server.config';
import { ObjectId } from 'mongodb';
import { pluginCache } from 'src/redis';
import { authService } from 'src/routers/handlers/auth.service';
import { basename, join } from 'node:path';
import { RootDirectory } from 'src/environment';
import { Configuration } from 'src/configuration';
import { IFileSchema, type IFile } from '@kompakkt/common';
import { SketchfabSchemas } from './schemas';

const BASE_URL = 'https://api.sketchfab.com/';
const CACHE_TIME_5_MINUTES = 300; // 5 minutes in seconds

const getUrl = (path: string) => {
  if (path.startsWith(BASE_URL)) return path;
  const url = new URL(path, BASE_URL);
  return url.toString();
};

const buildRequest = (path: string, token: string, init?: RequestInit) =>
  Bun.fetch(getUrl(path), {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Token ${token}`,
    },
  });

export const sketchfabImportRouterTag = 'Sketchfab Importer';

const sketchfabImportRouter = new Elysia()
  .use(configServer)
  .use(authService)
  .group('/sketchfab-import', app =>
    app
      .get(
        '/health',
        () => {
          return { status: 'OK' } as const;
        },
        {
          isLoggedIn: true,
          detail: {
            description: 'Health check endpoint to verify the service is running.',
            tags: [sketchfabImportRouterTag],
          },
          response: {
            200: t.Object({
              status: t.Literal('OK'),
            }),
          },
        },
      )
      .get(
        '/model-info/:id',
        async ({ params: { id }, status }) => {
          const cacheKey = `sketchfab::model-info::${id}`;
          const cached = await pluginCache.get(cacheKey);
          if (cached) return cached;

          const model = await Bun.fetch(new URL(`/v3/models/${id}`, BASE_URL).toString())
            .then(res => res.json())
            .catch(() => undefined);
          if (!model) return status(404, 'Model not found');
          await pluginCache.set(cacheKey, model, CACHE_TIME_5_MINUTES);
          return model;
        },
        {
          isLoggedIn: true,
          params: t.Object({
            id: t.String({ description: 'Sketchfab model ID' }),
          }),
          response: {
            200: SketchfabSchemas.ModelSchema,
            404: t.Any(),
          },
          detail: {
            description:
              'Fetches detailed information about a specific Sketchfab model using its ID.',
            tags: [sketchfabImportRouterTag],
          },
        },
      )
      .post(
        '/get-models',
        async ({ body: { token }, status }) => {
          const cacheKey = `sketchfab::get-models::${token}`;
          const cached = await pluginCache.get(cacheKey);
          if (cached) return cached;

          const sketchfabUser = await buildRequest('/v3/me', token)
            .then(res => res.json() as Promise<SketchfabSchemas.MeResponse>)
            .catch(() => undefined);
          if (!sketchfabUser?.modelsUrl) return status(404, 'User not found with token');
          const modelsUrl = new URL(sketchfabUser.modelsUrl);
          modelsUrl.searchParams.set('downloadable', 'true');
          const models = await buildRequest(modelsUrl.toString(), token)
            .then(res => res.json().then(data => data as SketchfabSchemas.ModelsResponse))
            .catch(() => undefined);

          if (!models) return status(404, 'Could not fetch models for user');
          const result = {
            status: 'OK',
            user: sketchfabUser,
            models: models.results,
          };

          await pluginCache.set(cacheKey, result, CACHE_TIME_5_MINUTES);

          return {
            status: 'OK',
            user: sketchfabUser,
            models: models.results,
          };
        },
        {
          isLoggedIn: true,
          body: t.Object({
            token: t.String({ description: 'Sketchfab API token' }),
          }),
          response: {
            200: t.Object({
              status: t.Literal('OK'),
              user: SketchfabSchemas.MeResponseSchema,
              models: t.Array(SketchfabSchemas.PartialModelFromModelsResponseSchema),
            }),
            404: t.Any(),
          },
          detail: {
            tags: [sketchfabImportRouterTag],
          },
        },
      )
      .post(
        '/download-and-prepare-model',
        async ({ body: { token, modelId }, userdata, status }) => {
          token = 'f8c23b01a7dd46b997084c95dcd97188';
          if (!userdata) return status(401, 'No user data found');

          const cacheKey = `sketchfab::download-and-prepare-model::${token}::${modelId}`;
          const cached = await pluginCache.get(cacheKey);
          if (cached) return cached;

          const downloadDetails = await buildRequest(`/v3/models/${modelId}/download`, token)
            .then(res => res.json() as Promise<SketchfabSchemas.DownloadResponse>)
            .catch(() => undefined);
          if (!downloadDetails?.glb?.url) return status(404, 'Model not found or not downloadable');

          const uploadsDir = join(RootDirectory, Configuration.Uploads.UploadDirectory);
          const outDir = join(uploadsDir, 'model', new ObjectId().toString());

          const downloadUrl = downloadDetails.glb.url;
          const filename = basename(new URL(downloadUrl).pathname);

          const file = await Bun.fetch(downloadUrl);
          const finalPath = join(outDir, filename);
          await Bun.write(finalPath, await file.arrayBuffer());

          const result = {
            file_name: filename,
            file_link: finalPath.replace(RootDirectory, '').slice(1),
            file_format: '.glb',
            file_size: downloadDetails.glb.size,
          } satisfies IFile;

          await pluginCache.set(cacheKey, result, CACHE_TIME_5_MINUTES);

          return result;
        },
        {
          isLoggedIn: true,
          body: t.Object({
            token: t.String({ description: 'Sketchfab API token' }),
            modelId: t.String({ description: 'Sketchfab model ID' }),
          }),
          response: {
            200: IFileSchema,
            404: t.Any(),
            401: t.Any(),
          },
          detail: {
            tags: [sketchfabImportRouterTag],
          },
        },
      ),
  );

export default sketchfabImportRouter;
