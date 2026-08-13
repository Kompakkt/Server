import { log, warn } from 'src/logger';
import { isWikibaseConfiguration, WikibaseConfiguration } from './config';

export default async () => {
  if (!isWikibaseConfiguration(WikibaseConfiguration)) {
    warn(
      WikibaseConfiguration
        ? `Wikibase configuration is incorrect`
        : `Wikibase configuration does not exist`,
    );
    log(
      `
Possible environment variables to configure wikibase plugin:
Required:
CONFIGURATION_EXTENSION_WIKIBASE_DOMAIN
CONFIGURATION_EXTENSION_WIKIBASE_SPARQL_ENDPOINT
CONFIGURATION_EXTENSION_WIKIBASE_REST_API_URL
CONFIGURATION_EXTENSION_WIKIBASE_OAUTH_TOKEN

Optional:
CONFIGURATION_EXTENSION_WIKIBASE_PUBLIC
CONFIGURATION_EXTENSION_WIKIBASE_PREFIX_DOMAIN
CONFIGURATION_EXTENSION_WIKIBASE_TTL_FILE_URL
`.trim(),
    );
    return false;
  }

  return true;
};
