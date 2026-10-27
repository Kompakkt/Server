import { getAccessToken } from './oauth';

const USER_AGENT =
  Bun.env['CONFIGURATION_EXTENSION_WIKIBASE_USER_AGENT'] ??
  'Kompakkt-Server/0.0.1 (https://kompakkt.de)';

const baseUrl = () => Bun.env['CONFIGURATION_EXTENSION_WIKIBASE_REST_API_URL'] ?? '';

export const customFetch = async (input: string, init: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(init.headers);
  const token = await getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('User-Agent', USER_AGENT);
  return Bun.fetch(`${baseUrl()}${input}`, { ...init, headers });
};
