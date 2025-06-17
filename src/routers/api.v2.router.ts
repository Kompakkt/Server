import { Elysia, t } from 'elysia';
import { entityCollection } from 'src/mongo';
import configServer from 'src/server.config';
import { authService } from './handlers/auth.service';
import { Collection, type IDocument } from 'src/common';
import { resolveUserDocument } from './modules/user-management/users';

const apiV2Router = new Elysia().use(configServer).group('/api/v2', app =>
  app
    .use(authService)
    .get(
      '/user-data/:collection',
      async ({ userdata, error, params: { collection }, query: { full } }) => {
        const user = structuredClone(userdata);
        if (!user) return error(500);
        const data = user.data[collection] ?? [];
        const resolved = await Promise.all(
          Array.from(new Set(data)).map(docId => resolveUserDocument(docId, collection, full)),
        );
        const filtered = resolved.filter((obj): obj is IDocument => obj !== undefined);
        return filtered;
      },
      {
        isLoggedIn: true,
        params: t.Object({
          collection: t.Enum(Collection, {
            description:
              'The collection to retrieve user data from, e.g., "entity", "compilation", etc.',
          }),
        }),
        query: t.Object({
          full: t.Optional(
            t.Boolean({
              description: 'If true, deeply resolves documents of the requested collection',
            }),
          ),
        }),
      },
    )
    .get('/list-entity-formats', async () => {
      const result = await entityCollection.distinct('processed.raw', {
        'online': true,
        'finished': true,
        'processed.raw': { $exists: true, $ne: null },
      });

      const formats = new Set<string>();

      result.forEach(rawPath => {
        if (typeof rawPath === 'string') {
          const format = rawPath.split('.').pop()?.toLowerCase();
          if (format) formats.add(format);
        }
      });

      return Array.from(formats).sort();
    })
    .get(
      '/entities-by-format/:formats',
      async ({ params: { formats } }) => {
        const formatList = formats.split(',').map(format => format.trim().toLowerCase());

        const results = await entityCollection
          .aggregate([
            {
              $match: {
                'online': true,
                'finished': true,
                'processed.raw': { $exists: true, $ne: null },
              },
            },
            {
              $addFields: {
                fileExtension: {
                  $toLower: {
                    $arrayElemAt: [{ $split: ['$processed.raw', '.'] }, -1],
                  },
                },
              },
            },
            {
              $match: {
                fileExtension: { $in: formatList },
              },
            },
            {
              $project: {
                _id: 1,
                fileExtension: 1,
              },
            },
          ])
          .toArray();

        return {
          formats: formatList,
          entities: Array.from(new Set(results.map(e => e._id))).sort(),
        };
      },
      {
        params: t.Object({
          formats: t.String({
            description:
              'The format to filter entities by to retrieve, e.g., "glb", "obj", etc.\nCan be a comma separated list of formats.',
          }),
        }),
      },
    ),
);

export default apiV2Router;
