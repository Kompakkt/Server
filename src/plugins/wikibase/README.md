# Wikibase plugin

Reads from and writes entities to a remote Wikibase instance, and mirrors
Kompakkt annotations/digital entities there.

## Wikibase instance requirements

- **MediaWiki ≥ 1.35** with **Extension:OAuth** and **OAuth 2.0** enabled.
- **Wikibase REST API** enabled at the version matching the generated client
  (currently spec `1.4`, produced from the instance's
  `/w/rest_v1/openapi.json`).
- A registered **OAuth 2.0 consumer** authorised against a user holding the
  rights the plugin needs: **edit**, **upload**, **delete** (MediaWiki grants
  `editpage`, `uploadfile`, `delete`). That consumer's access token is the
  single credential the plugin uses.
- A **`User-Agent`** the Wikibase REST API accepts (the Wikimedia UA policy
  wants name/version + a contact). The plugin sends
  `Kompakkt-Server/0.0.1 (https://kompakkt.de)` by default; override with
  `CONFIGURATION_EXTENSION_WIKIBASE_USER_AGENT`.

## Required environment variables

- `CONFIGURATION_EXTENSION_WIKIBASE_DOMAIN` — Wikibase instance base URL
  (e.g. `http://wb.local`).
- `CONFIGURATION_EXTENSION_WIKIBASE_REST_API_URL` — REST API base
  (e.g. `http://wb.local/w/rest_v1`). Used by the generated REST client.
- `CONFIGURATION_EXTENSION_WIKIBASE_SPARQL_ENDPOINT` — SPARQL endpoint
  (e.g. `http://query.wb.local/proxy/wdqs/bigdata/namespace/wdq/sparql`).
- `CONFIGURATION_EXTENSION_WIKIBASE_OAUTH_TOKEN` — the OAuth 2.0 bearer token.

Optional:

- `CONFIGURATION_EXTENSION_WIKIBASE_PUBLIC` — public URL used for the
  `annotationText` link; falls back to `Domain`.
- `CONFIGURATION_EXTENSION_WIKIBASE_PREFIX_DOMAIN` — entity/prop prefix base
  used by the SPARQL templates in `sparks.ts`.
- `CONFIGURATION_EXTENSION_WIKIBASE_TTL_FILE_URL` — data-model TTL used to
  resolve P/Q ids in `parsed-model.ts` (defaults to the upstream
  `wikibase_generic_model.ttl`).

### Deprecated (ignored)

`CONFIGURATION_EXTENSION_WIKIBASE_USERNAME`,
`CONFIGURATION_EXTENSION_WIKIBASE_PASSWORD`,
`CONFIGURATION_EXTENSION_WIKIBASE_ADMIN_USERNAME`,
`CONFIGURATION_EXTENSION_WIKIBASE_ADMIN_PASSWORD`. Setting them logs a
deprecation warning; the plugin authenticates exclusively via the OAuth
token.

## SPARQL endpoint auth

`sparql.ts` reads SPARQL results with a plain GET, assuming an open endpoint
(the historical setup). If your SPARQL endpoint is locked down, the reads need
`Authorization: Bearer ${CONFIGURATION_EXTENSION_WIKIBASE_OAUTH_TOKEN}` added
in `sparql.ts` (open question in the migration plan).

## Regenerating the REST client

```
WIKIBASE_OPENAPI_URL=https://wikibase.example/w/rest_v1/openapi.json \
  bun run generate:wikibase-client
```

The generator runs `orval`, then rewrites every `fetch(...)` call to use the
`customFetch` mutator in `rest-fetch.ts`, which prepends
`CONFIGURATION_EXTENSION_WIKIBASE_REST_API_URL` and injects the OAuth bearer
token + `User-Agent`. The generated `rest-api-client.ts` is tracked in the
repo (regeneration is not part of CI), so the plugin stays buildable without
network access to a live Wikibase.

## What still uses the MediaWiki Action API (not the REST API)

`connector.ts` is a small OAuth-only shim that the REST API cannot replace:

- `writeAnnotation` — creates the `Annotation:Qxxx` wikitext page
  (`action=edit`).
- `writeImage` — uploads `PreviewQxxx.<ext>` to the File namespace
  (`action=upload`).
- `removeItem` — deletes a Wikibase item (`action=delete`, title = raw Q-id;
  the REST spec we generate from has no item delete).

SPARQL query execution lives in `sparql.ts`; entity create/edit/search lives in
`service.ts` through the generated REST client; the statement shape is built by
`statements.ts`.
