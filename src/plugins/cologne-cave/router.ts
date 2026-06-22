import Elysia, { t } from 'elysia';
import { entityCollection } from 'src/mongo';
import { apiKeyService } from 'src/routers/handlers/api-key.service';
import configServer from 'src/server.config';

export const cologneCaveRouterTag = 'Cologne Cave';

const cologneCaveRouter = new Elysia()
  .use(configServer)
  .use(apiKeyService)
  .group('/cologne-cave-api', app =>
    app.get(
      '/all-entities',
      async ({ query: { limit, offset, format } }) => {
        const formats = (format ?? 'glb')
          .split(',')
          .map(f => f.trim().toLowerCase())
          .filter(f => /^[a-z0-9]+$/.test(f));
        const regex = formats.length ? new RegExp(`\\.(${formats.join('|')})$`, 'i') : /\.glb$/i;
        const entities = await entityCollection
          .find({
            'online': true,
            'finished': true,
            'processed.raw': { $regex: regex },
          })
          .skip(offset ?? 0)
          .limit(limit ?? Number.MAX_SAFE_INTEGER)
          .toArray();
        return entities;
      },
      {
        hasValidApiKey: true,
        query: t.Object({
          key: t.String({
            type: 'string',
            description: 'API key for authentication',
          }),
          limit: t.Optional(
            t.Number({
              type: 'number',
              description: 'Maximum number of entities to return',
            }),
          ),
          offset: t.Optional(
            t.Number({
              type: 'number',
              description: 'Offset for pagination',
            }),
          ),
          format: t.Optional(
            t.String({
              type: 'string',
              description:
                'Comma-separated list of file formats to filter by (e.g. "obj,glb"). Defaults to "glb".',
            }),
          ),
        }),
        response: {
          200: t.Any({
            description: 'Array of CAVE compatible entities that are marked as online and finished',
          }),
        },
        detail: {
          tags: [cologneCaveRouterTag],
          description:
            'Retrieve all CAVE compatible entities that are marked as online and finished, with optional pagination. CAVE: https://itcc.uni-koeln.de/en/hpc/visualization/cave',
        },
      },
    ),
  );

export default cologneCaveRouter;
