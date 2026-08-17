const USER_AGENT =
  Bun.env['CONFIGURATION_EXTENSION_WIKIBASE_USER_AGENT'] ??
  'Kompakkt-Server/0.0.1 (https://kompakkt.de)';

const baseUrl = () => Bun.env['CONFIGURATION_EXTENSION_WIKIBASE_REST_API_URL'] ?? '';
const oauthToken = () => Bun.env['CONFIGURATION_EXTENSION_WIKIBASE_OAUTH_TOKEN'] ?? '';

export const customFetch = async (input: string, init: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(init.headers);
  const token = oauthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('User-Agent', USER_AGENT);
  return Bun.fetch(`${baseUrl()}${input}`, { ...init, headers });
};
