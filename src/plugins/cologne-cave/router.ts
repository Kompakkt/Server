import Elysia, { t } from 'elysia';
import { entityCollection } from 'src/mongo';
import { apiKeyService } from 'src/routers/handlers/api-key.service';
import { RouterTags } from 'src/routers/tags';
import configServer from 'src/server.config';

const cologenCaveRouter = new Elysia()
  .use(configServer)
  .use(apiKeyService)
  .group('/cologne-cave-api', app =>
    app.get(
      '/all-entities',
      async ({ query: { limit, offset } }) => {
        const entities = await entityCollection
          .find({
            'online': true,
            'finished': true,
            // Does raw filename end with '.glb'?
            'processed.raw': { $regex: /\.glb$/i },
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
        }),
        response: {
          200: t.Any({
            description: 'Array of CAVE compatible entities that are marked as online and finished',
          }),
        },
        detail: {
          tags: [RouterTags['Cologne Cave']],
          description:
            'Retrieve all CAVE compatible entities that are marked as online and finished, with optional pagination. CAVE: https://itcc.uni-koeln.de/en/hpc/visualization/cave',
        },
      },
    ),
  );

export default cologenCaveRouter;
