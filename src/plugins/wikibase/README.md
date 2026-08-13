# Wikibase plugin

Reads from and writes entities to a remote Wikibase instance, and mirrors
Kompakkt annotations/digital entities there.

## Wikibase instance requirements

- **MediaWiki ≥ 1.35** with **Extension:OAuth** and **OAuth 2.0** enabled.
- **Wikibase REST API** enabled at the version matching the generated client
  (currently spec `1.4`, produced from the instance's
  `/w/rest.php/wikibase/v1/openapi.json`).
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
  (e.g. `http://wb.local/w/rest.php/wikibase/v1/`). Used by the generated REST
  client; also derives the OAuth token endpoint (`…/rest.php/oauth2/access_token`).
- `CONFIGURATION_EXTENSION_WIKIBASE_SPARQL_ENDPOINT` — SPARQL endpoint
  (e.g. `http://query.wb.local/proxy/wdqs/bigdata/namespace/wdq/sparql`).

### Authentication

OAuth 2.0 `client_credentials` against an **owner-only** consumer (created via
`OAuth:createOAuthConsumer --oauthVersion=2 --ownerOnly
--oauth2GrantTypes=client_credentials`, or the `Special:OAuthConsumerRegistration`
UI):

- `CONFIGURATION_EXTENSION_WIKIBASE_OAUTH_KEY` — the consumer key (`client_id`).
- `CONFIGURATION_EXTENSION_WIKIBASE_OAUTH_SECRET` — the consumer secret
  (`client_secret`).

The plugin exchanges key/secret for a bearer token at runtime and caches it for
its `expires_in` lifetime (refreshing before expiry). A static token is supported
as a fallback:

- `CONFIGURATION_EXTENSION_WIKIBASE_OAUTH_TOKEN` — a pre-issued OAuth 2.0 access
  token; used only when key/secret are not set.

Optional:

- `CONFIGURATION_EXTENSION_WIKIBASE_PUBLIC` — public URL used for the
  `annotationText` link; falls back to `Domain`.
- `CONFIGURATION_EXTENSION_WIKIBASE_PREFIX_DOMAIN` — entity/prop prefix base
  used by the SPARQL templates in `sparks.ts`. See the FAQ below for why
  installation-specific values can differ.
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

`sparql.ts` sends the same bearer token used for REST/Action API requests
(`sparqlRequestHeaders`). If your SPARQL endpoint is locked down, the reads need
this header to succeed (open question in the migration plan).

## Regenerating the REST client

```
WIKIBASE_OPENAPI_URL=https://wikibase.example/w/rest.php/wikibase/v1/openapi.json \
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

## FAQ

### Why do SPARQL reads return nothing (or fail) even though the wikibase works?

The entity create/edit/search (via the REST API) and the SPARQL queries use two
different "languages" for the same data:

- The REST API addresses items as plain `Q5`, `P1` ids.
- The SPARQL queries address them as URIs — `tib:Q5`, `tibt:P1` — where the
  `tib:`/`tibt:` prefixes must expand to _exactly_ the base URIs the instance
  writes into its RDF graph.

Whether a SPARQL query needs `PREFIX` declarations at all, and what they must
expand to, depends entirely on the instance.

Symptom cheat sheet:

- Auth works, SPARQL errors mention `tib`/`tibt` (undeclared prefix) or 400: `PREFIX_DOMAIN` unset on a WDQS/Blazegraph endpoint
- Auth works, SPARQL answers, but always 0 results while the wikibase has data: `PREFIX_DOMAIN` set to a base that doesn't match the instance's RDF URIs (or set on an endpoint that resolves prefixes itself)
- Choices/metadata lists are all empty: Same as above — they fetch data through the SPARQL endpoint

To find the right value: compare against any _existing_ item's RDF. On an
unprotected wiki, open
`<domain>/wiki/Special:EntityData/Q<existing-id>.ttl` (Turtle export) and use
the entity URI base there, i.e. everything before `/entity/Q…`. If the wiki
requires a login for that page, view the TTL export while logged in, or check
the SPARQL endpoint directly with a query like
`SELECT ?s WHERE { ?s ?p ?o } LIMIT 5` and inspect the subject URIs.
