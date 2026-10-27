import { err, warn } from 'src/logger';
import { post } from 'src/util/requests';
import { WikibaseConfiguration } from './config';

type OAuth2TokenResponse = {
  token_type?: string;
  expires_in?: number;
  access_token?: string;
};

type AccessTokenResponse = {
  token: string;
  expiresIn: number;
};

const TOKEN_REFRESH_MARGIN_MS = 60_000;

const staticToken = () => WikibaseConfiguration?.OauthToken ?? '';
const keyAndSecret = () => ({
  key: WikibaseConfiguration?.OauthKey ?? '',
  secret: WikibaseConfiguration?.OauthSecret ?? '',
});

const restBase = () => {
  const RestAPIURL = WikibaseConfiguration?.RestAPIURL ?? '';
  const stripped = RestAPIURL.replace(/wikibase\/v1\/?$/, '').replace(/\/+$/, '');
  return stripped || `${WikibaseConfiguration?.Domain ?? ''}`.replace(/\/+$/, '');
};

const exchangeAccessToken = async (): Promise<AccessTokenResponse> => {
  const { key, secret } = keyAndSecret();
  if (!key || !secret) {
    throw new Error(
      'OAuth2 client_credentials requires CONFIGURATION_EXTENSION_WIKIBASE_OAUTH_KEY and CONFIGURATION_EXTENSION_WIKIBASE_OAUTH_SECRET',
    );
  }
  const url = `${restBase()}/oauth2/access_token`;
  const response = (await post(url, {
    options: {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          Bun.env['CONFIGURATION_EXTENSION_WIKIBASE_USER_AGENT'] ??
          'Kompakkt-Server/0.0.1 (https://kompakkt.de)',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: key,
        client_secret: secret,
      }).toString(),
    },
    throwOnHttpError: true,
  }).catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    err('Wikibase OAuth2 token exchange failed', message);
    throw new Error(`Wikibase OAuth2 token exchange failed (${url}): ${message}`);
  })) as OAuth2TokenResponse | string;

  if (typeof response === 'string') {
    throw new Error(`Unexpected OAuth2 token response from ${url}: ${response.slice(0, 256)}`);
  }
  if (typeof response.access_token !== 'string' || typeof response.expires_in !== 'number') {
    throw new Error(
      `Unexpected OAuth2 token response from ${url}: ${JSON.stringify(response).slice(0, 256)}`,
    );
  }
  return { token: response.access_token, expiresIn: response.expires_in };
};

let cachedAccessToken: { token: string; validUntil: number } | undefined;
let tokenRequest: Promise<string> | undefined;

const fetchAccessToken = (): Promise<string> => {
  if (cachedAccessToken && cachedAccessToken.validUntil > Date.now()) {
    return Promise.resolve(cachedAccessToken.token);
  }
  tokenRequest ??= exchangeAccessToken().then(response => {
    cachedAccessToken = {
      token: response.token,
      validUntil: Date.now() + response.expiresIn * 1000 - TOKEN_REFRESH_MARGIN_MS,
    };
    return cachedAccessToken.token;
  });
  return tokenRequest.finally(() => {
    tokenRequest = undefined;
  });
};

export const getAccessToken = async (): Promise<string> => {
  const { key, secret } = keyAndSecret();

  if (!key || !secret) {
    if (staticToken()) return staticToken();
    warn(
      'No wikibase OAuth credentials configured: set CONFIGURATION_EXTENSION_WIKIBASE_OAUTH_KEY and CONFIGURATION_EXTENSION_WIKIBASE_OAUTH_SECRET (or CONFIGURATION_EXTENSION_WIKIBASE_OAUTH_TOKEN as a static fallback)',
    );
    return '';
  }

  return fetchAccessToken();
};

export const hasWikibaseOAuthCredentials = () => {
  const { key, secret } = keyAndSecret();
  return (!!key && !!secret) || !!staticToken();
};
