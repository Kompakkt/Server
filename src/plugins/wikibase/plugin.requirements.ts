import { log, warn } from 'src/logger';
import { isWikibaseConfiguration, WikibaseConfiguration } from './config';

export default async () => {
  if (isWikibaseConfiguration(WikibaseConfiguration)) {
    return true;
  } else {
    warn(
      !!WikibaseConfiguration
        ? `Wikibase configuration is incorrect`
        : `Wikibase configuration does not exist`,
    );
    log(
      `
Possible environment variables to configure wikibase plugin:

CONFIGURATION_EXTENSION_WIKIBASE_DOMAIN
CONFIGURATION_EXTENSION_WIKIBASE_SPARQL_ENDPOINT
CONFIGURATION_EXTENSION_WIKIBASE_USERNAME
CONFIGURATION_EXTENSION_WIKIBASE_PASSWORD
CONFIGURATION_EXTENSION_WIKIBASE_ADMIN_USERNAME
CONFIGURATION_EXTENSION_WIKIBASE_ADMIN_PASSWORD

CONFIGURATION_EXTENSION_WIKIBASE_KOMPAKKT_ADDRESS
CONFIGURATION_EXTENSION_WIKIBASE_PUBLIC
CONFIGURATION_EXTENSION_WIKIBASE_PREFIX_DOMAIN
CONFIGURATION_EXTENSION_WIKIBASE_TTL_FILE_URL
`.trim(),
    );
  }
  return false;
};
