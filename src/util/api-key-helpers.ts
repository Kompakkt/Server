import { apiKeyCollection, type ApiKeyDocument } from 'src/mongo';
import type { ServerDocument } from './document-with-objectid-type';
import { err, log, warn } from 'src/logger';

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
      log(`API key ${key.key} used at ${new Date(now).toISOString()}`);
    })
    .catch(error => {
      err(`Failed to update last used time for API key ${key.key}: ${error.message}`);
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
