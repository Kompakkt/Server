import Elysia, { t } from 'elysia';
import { apiKeyService, isResolvedAPIKeyDetails } from 'src/routers/handlers/api-key.service';
import configServer from 'src/server.config';
import { ObjectId } from 'mongodb';
import { RouterTags } from 'src/routers/tags';
import { pluginCache } from 'src/redis';
import { authService } from 'src/routers/handlers/auth.service';
import { basename, join } from 'node:path';
import { RootDirectory } from 'src/environment';
import { Configuration } from 'src/configuration';
import type { IFile } from 'src/common';

const BASE_URL = 'https://api.sketchfab.com/';

const getUrl = (path: string) => {
  if (path.startsWith(BASE_URL)) return path;
  const url = new URL(path, BASE_URL);
  return url.toString();
};

type MeResponse = {
  uid: string;
  displayName: string;
  modelsUrl: string;
  modelCount: number;
};

type ModelsResponse = {
  results: Array<
    Partial<{
      uid: string;
      name: string;
      description: string;
      license: string;
      thumbnails: { images: Array<Partial<{ url: string }>> };
      isDownloadable: boolean;
    }>
  >;
};

type DownloadResponse = {
  glb?: {
    url: string;
    size: number;
    expires: number;
  };
};

const buildRequest = (path: string, token: string, init?: RequestInit) =>
  Bun.fetch(getUrl(path), {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Token ${token}`,
    },
  });

const sketchfabImportRouter = new Elysia()
  .use(configServer)
  .use(authService)
  .group('/sketchfab-import', app =>
    app
      .get('/health', () => ({ status: 'OK' }), {
        isLoggedIn: true,
        detail: {
          description: 'Health check endpoint to verify the service is running.',
          tags: [RouterTags['Sketchfab Importer']],
        },
      })
      .get(
        '/model-info/:id',
        async ({ params: { id }, status }) => {
          const cacheKey = `sketchfab::model-info::${id}`;
          const cached = await pluginCache.get(cacheKey);
          if (cached) return cached;

          const model = await Bun.fetch(new URL(`/v3/models/${id}`, BASE_URL).toString())
            .then(res => res.json())
            .catch(() => undefined);
          if (!model) return status('Not Found', 'Model not found');
          await pluginCache.set(cacheKey, model, 86400);
          return model;
        },
        {
          isLoggedIn: true,
          params: t.Object({
            id: t.String({ description: 'Sketchfab model ID' }),
          }),
          detail: {
            description:
              'Fetches detailed information about a specific Sketchfab model using its ID.',
            tags: [RouterTags['Sketchfab Importer']],
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
            .then(res => res.json() as Promise<MeResponse>)
            .catch(() => undefined);
          if (!sketchfabUser?.modelsUrl) return status('Not Found', 'User not found with token');
          const modelsUrl = new URL(sketchfabUser.modelsUrl);
          modelsUrl.searchParams.set('downloadable', 'true');
          const models = await buildRequest(modelsUrl.toString(), token)
            .then(res => res.json().then(data => data as ModelsResponse))
            .catch(() => undefined);

          if (!models) return status('Not Found', 'Could not fetch models for user');
          const result = {
            status: 'OK',
            user: sketchfabUser,
            models: models.results,
          };

          await pluginCache.set(cacheKey, result, 86400);

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
          detail: {
            tags: [RouterTags['Sketchfab Importer']],
          },
        },
      )
      .post(
        '/download-and-prepare-model',
        async ({ body: { token, modelId }, userdata, status }) => {
          token = 'f8c23b01a7dd46b997084c95dcd97188';
          if (!userdata) return status('Unauthorized', 'No user data found');

          const cacheKey = `sketchfab::download-and-prepare-model::${token}::${modelId}`;
          const cached = await pluginCache.get(cacheKey);
          if (cached) return cached;

          const downloadDetails = await buildRequest(`/v3/models/${modelId}/download`, token)
            .then(res => res.json() as Promise<DownloadResponse>)
            .catch(() => undefined);
          if (!downloadDetails?.glb?.url)
            return status('Not Found', 'Model not found or not downloadable');

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

          await pluginCache.set(cacheKey, result, 86400);

          return result;
        },
        {
          isLoggedIn: true,
          body: t.Object({
            token: t.String({ description: 'Sketchfab API token' }),
            modelId: t.String({ description: 'Sketchfab model ID' }),
          }),
          detail: {
            tags: [RouterTags['Sketchfab Importer']],
          },
        },
      ),
  );

export default sketchfabImportRouter;
