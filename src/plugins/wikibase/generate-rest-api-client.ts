import { join } from 'node:path';

console.time('generate-wikibase-client');

const OPENAPI_URL = process.env['WIKIBASE_OPENAPI_URL'];
if (!OPENAPI_URL) {
  console.error('WIKIBASE_OPENAPI_URL environment variable is not set.');
  console.error('Set it to the Wikibase REST API OpenAPI document URL, e.g. https://wikibase.example/w/rest_v1/openapi.json');
  process.exit(1);
}

const outFile = join(import.meta.dir, 'rest-api-client.ts');
await Bun.$`bunx orval --input ${OPENAPI_URL} --client fetch --output ${outFile}`.text();

let content = await Bun.file(outFile).text();
content = content.replaceAll('fetch(', 'customFetch(');
if (!content.includes("from './rest-fetch'")) {
  content = `import { customFetch } from './rest-fetch';\n` + content;
}
await Bun.write(outFile, content);

console.timeEnd('generate-wikibase-client');