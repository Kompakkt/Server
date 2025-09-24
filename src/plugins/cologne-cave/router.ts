import Elysia, { t } from 'elysia';
import { log } from 'src/logger';
import { apiKeyCollection, entityCollection } from 'src/mongo';
import configServer from 'src/server.config';
import { isRouteOfApiKey, validateApiKey } from 'src/util/api-key-helpers';

const cologenCaveRouter = new Elysia().use(configServer).get(
  '/cologne-cave-api/all-entities',
  async ({ query: { key, limit, offset }, route, status }) => {
    const keyDocument = await apiKeyCollection.findOne({ key });

    const { valid, expired } = await validateApiKey(keyDocument);
    log('Cave request', { keyDocument, valid, expired, route });

    if (!valid) {
      return status(401, 'Invalid API key');
    }
    if (expired) {
      return status(403, 'API key has expired');
    }

    const correctRoute = isRouteOfApiKey(route, keyDocument);
    if (!correctRoute) {
      return status(403, 'API key does not have access to this route');
    }

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
  },
);

export default cologenCaveRouter;
