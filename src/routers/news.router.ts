import { Elysia, t } from 'elysia';
import { ObjectId } from 'mongodb';
import { INewsItemSchema } from '@kompakkt/common';
import { newsCollection } from 'src/mongo';
import { RootDirectory } from 'src/environment';
import { Configuration } from 'src/configuration';
import configServer from 'src/server.config';
import { authService } from './handlers/auth.service';
import { RouterTags } from './tags';
import { info } from 'src/logger';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const NEWS_UPLOAD_DIR = join(RootDirectory, Configuration.Uploads.UploadDirectory, 'news');
const MAX_NEWS_IMAGE_RESOLUTION = 800;

const ensureUploadDir = async () => {
  await mkdir(NEWS_UPLOAD_DIR, { recursive: true }).catch(() => {});
};

export const newsRouter = new Elysia()
  .use(configServer)
  .use(authService)
  .group('/api/v2/news', app =>
    app
      // Public: get all published news items, sorted by date descending
      .get(
        '/',
        async () => {
          const items = await newsCollection.find({ published: true }).sort({ date: -1 }).toArray();
          return items;
        },
        {
          response: { 200: t.Array(INewsItemSchema) },
          detail: {
            description: 'Get all published news items sorted by date (newest first)',
            tags: [RouterTags.News],
          },
        },
      )
      // Flag-gated: get all news items (including unpublished) for management
      .get(
        '/all',
        async () => {
          const items = await newsCollection.find().sort({ date: -1 }).toArray();
          return items;
        },
        {
          canModifyNews: true,
          response: { 200: t.Array(INewsItemSchema) },
          detail: {
            description: 'Get all news items including unpublished (requires canModifyNews flag)',
            tags: [RouterTags.News],
          },
        },
      )
      // Flag-gated: create a news item
      .post(
        '/',
        async ({ body, userdata, status }) => {
          if (!userdata) return status(403, 'Not authenticated');

          const { title, content, link, imageUrl, published } = body;
          const now = new Date().toISOString();

          const doc = {
            title,
            content,
            link: link ?? '',
            imageUrl: imageUrl ?? '',
            author: userdata.fullname,
            createdBy: userdata._id.toString(),
            published: published ?? false,
            date: now,
          };

          const result = await newsCollection.insertOne(doc as any);
          if (!result.insertedId) return status(500, 'Failed to create news item');

          const created = await newsCollection.findOne({ _id: result.insertedId });
          if (!created) return status(500, 'Failed to retrieve created news item');
          return created;
        },
        {
          canModifyNews: true,
          body: t.Object({
            title: t.String({ maxLength: 120 }),
            content: t.String({ maxLength: 240 }),
            link: t.Optional(t.String()),
            imageUrl: t.Optional(t.String()),
            published: t.Optional(t.Boolean()),
          }),
          response: {
            200: INewsItemSchema,
            403: t.Any(),
            500: t.Any(),
          },
          detail: {
            description: 'Create a new news item (requires canModifyNews flag)',
            tags: [RouterTags.News],
          },
        },
      )
      // Flag-gated: update a news item
      .put(
        '/:id',
        async ({ params: { id }, body, status }) => {
          const _id = new ObjectId(id);
          const { title, content, link, imageUrl, published } = body;

          const updateResult = await newsCollection.updateOne(
            { _id },
            { $set: { title, content, link, imageUrl, published } },
          );
          if (!updateResult.matchedCount) return status(404, 'News item not found');

          const updated = await newsCollection.findOne({ _id });
          if (!updated) return status(500, 'Failed to retrieve updated news item');
          return updated;
        },
        {
          canModifyNews: true,
          params: t.Object({ id: t.String() }),
          body: t.Object({
            title: t.String({ maxLength: 120 }),
            content: t.String({ maxLength: 240 }),
            link: t.Optional(t.String()),
            imageUrl: t.Optional(t.String()),
            published: t.Optional(t.Boolean()),
          }),
          response: {
            200: INewsItemSchema,
            403: t.Any(),
            404: t.Any(),
            500: t.Any(),
          },
          detail: {
            description: 'Update an existing news item (requires canModifyNews flag)',
            tags: [RouterTags.News],
          },
        },
      )
      // Flag-gated: delete a news item
      .delete(
        '/:id',
        async ({ params: { id }, status }) => {
          const _id = new ObjectId(id);
          const result = await newsCollection.deleteOne({ _id });
          if (!result.deletedCount) return status(404, 'News item not found');
          return { status: 'OK' as const };
        },
        {
          canModifyNews: true,
          params: t.Object({ id: t.String() }),
          response: {
            200: t.Object({ status: t.Literal('OK') }),
            403: t.Any(),
            404: t.Any(),
          },
          detail: {
            description: 'Delete a news item (requires canModifyNews flag)',
            tags: [RouterTags.News],
          },
        },
      )
      // Flag-gated: upload an image for a news item
      .post(
        '/upload-image',
        async ({ body: { file } }) => {
          await ensureUploadDir();

          const buffer = Buffer.from(await file.arrayBuffer());
          const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
          const filepath = join(NEWS_UPLOAD_DIR, filename);

          await sharp(buffer)
            .resize({
              fit: 'inside',
              width: MAX_NEWS_IMAGE_RESOLUTION,
              height: MAX_NEWS_IMAGE_RESOLUTION,
            })
            .webp({ quality: 80 })
            .toFile(filepath);

          info(`News image uploaded: ${filename}`);
          return { url: `/server/uploads/news/${filename}` };
        },
        {
          canModifyNews: true,
          body: t.Object({
            file: t.File(),
          }),
          response: {
            200: t.Object({ url: t.String() }),
            403: t.Any(),
          },
          type: 'multipart/form-data',
          detail: {
            description: 'Upload an image for a news item (requires canModifyNews flag)',
            tags: [RouterTags.News],
          },
        },
      ),
  );
