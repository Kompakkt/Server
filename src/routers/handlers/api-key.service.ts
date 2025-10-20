import Elysia, { t } from 'elysia';
import { apiKeyCollection, type ApiKeyDocument } from 'src/mongo';
import { err, log, warn } from 'src/logger';
import type { ServerDocument } from 'src/util/document-with-objectid-type';

export const validateApiKey = async (key?: ServerDocument<ApiKeyDocument> | null) => {
  if (!key) {
    return { valid: false, expired: false };
  }
  const { expirationDate } = key;
  const now = Date.now();
  if (expirationDate && now > expirationDate) {
    warn(`API key ${key.key} has expired at ${new Date(expirationDate).toISOString()}`);
    return { valid: true, expired: true };
  }
  await apiKeyCollection
    .updateOne({ key: key.key }, { $set: { lastUsed: now } })
    .then(() => {
      log(`API key "${key.description}" used at ${new Date(now).toISOString()}`);
    })
    .catch(error => {
      err(`Failed to update last used time for API key ${key.description}: ${error.message}`);
    });
  return { valid: true, expired: false };
};

export const isRouteOfApiKey = (
  route: string,
  key?: ServerDocument<ApiKeyDocument> | null,
): boolean => {
  if (!key) {
    return false;
  }
  const { routes } = key;
  return routes.some(r => r.includes(route) || route.includes(r));
};

export type ResolvedAPIKeyDetails = {
  apiKey: {
    key: string;
    keyDocument: ServerDocument<ApiKeyDocument>;
    valid: boolean;
    expired: boolean;
    validRoute: boolean;
  };
};
export const isResolvedAPIKeyDetails = (obj: unknown): obj is ResolvedAPIKeyDetails['apiKey'] => {
  return typeof obj === 'object' && obj !== null && 'key' in obj;
};

export const apiKeyService = new Elysia({ name: 'apiKeyService' })
  .resolve(
    { as: 'global' },
    async ({ query, route }): Promise<undefined | ResolvedAPIKeyDetails> => {
      if (!('key' in query) || typeof query.key !== 'string') return;
      const key = query.key;
      const keyDocument = await apiKeyCollection.findOne({ key });
      if (!keyDocument) return;
      const { valid, expired } = await validateApiKey(keyDocument);
      const validRoute = isRouteOfApiKey(route, keyDocument);
      return { apiKey: { key, keyDocument, valid, expired, validRoute } } as ResolvedAPIKeyDetails;
    },
  )
  .macro({
    hasValidApiKey: {
      query: t.Object({
        key: t.String({
          type: 'string',
          description: 'API key for authentication',
        }),
      }),
      resolve: async ({ status, route, apiKey }) => {
        if (!isResolvedAPIKeyDetails(apiKey)) return status(400, 'API key is required');
        const { keyDocument, valid, expired, validRoute } = apiKey;
        log(
          `Checking API key "${keyDocument?.description}" for route: ${route}. Valid: ${valid}, Expired: ${expired}, Valid Route: ${validRoute}`,
        );
        if (!valid) return status(401, 'Invalid API key');
        if (expired) return status(403, 'API key has expired');
        if (!validRoute) return status(403, 'API key does not have access to this route');
        return;
      },
    },
  });
