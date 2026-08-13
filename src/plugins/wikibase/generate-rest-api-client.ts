import { join } from 'node:path';

console.time('generate-wikibase-client');

const OPENAPI_URL = process.env['WIKIBASE_OPENAPI_URL'];
if (!OPENAPI_URL) {
  console.error('WIKIBASE_OPENAPI_URL environment variable is not set.');
  process.exit(1);
}

const outFile = join(import.meta.dir, 'rest-api-client.ts');
const _orvalOutput =
  await Bun.$`bunx orval --input ${OPENAPI_URL} --client fetch --output ${outFile}`.text();
console.log(_orvalOutput);
const content = await Bun.file(outFile).text();
const withBaseUrl = content.replaceAll(
  'fetch(',
  "fetch((Bun.env['CONFIGURATION_EXTENSION_WIKIBASE_REST_API_URL'] ?? '') + ",
);
await Bun.write(outFile, withBaseUrl);

console.timeEnd('generate-wikibase-client');
