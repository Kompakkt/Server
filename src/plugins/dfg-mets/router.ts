import Elysia, { t } from 'elysia';
import { isEntity } from 'src/common';
import type { IEntity } from 'src/common/interfaces';
import { Configuration } from 'src/configuration';
import { entityCollection } from 'src/mongo';
import { apiKeyService } from 'src/routers/handlers/api-key.service';
import { RESOLVE_FULL_DEPTH, resolveEntity } from 'src/routers/modules/api.v1/resolving-strategies';
import { RouterTags } from 'src/routers/tags';
import configServer from 'src/server.config';
import { buildMets } from './build-mets';
import type { DfgMetsExtensionData } from './types';

const dfgMetsRouter = new Elysia()
  .use(configServer)
  .use(apiKeyService)
  .group('/dfg-mets-api', app =>
    app
      .get(
        '/entity/:id',
        async ({ params: { id }, status }) => {
          const entity = (await resolveEntity(id, RESOLVE_FULL_DEPTH)) as
            | IEntity<DfgMetsExtensionData, true>
            | undefined;
          if (!entity) return status(404, 'Entity not found');
          if (!entity.extensions?.dfgMets?.sharingEnabled)
            return status(403, 'DFG METS sharing not enabled for this entity');

          return await buildMets({ entity });
        },
        {
          hasValidApiKey: true,
          query: t.Object({
            key: t.String({
              type: 'string',
              description: 'API key for authentication',
            }),
          }),
          params: t.Object({
            id: t.String({
              type: 'string',
              description: 'ID of the entity to retrieve',
            }),
          }),
          detail: {
            tags: [RouterTags['DFG METS']],
            description:
              'Retrieve a specific entity by ID if it has DFG METS sharing enabled, returning METS/MODS XML format. Requires valid API key.',
          },
        },
      )
      .get(
        '/entities',
        async ({ query: { limit, offset } }) => {
          const entities = await entityCollection
            .find({
              'online': true,
              'finished': true,
              'extensions.dfgMets.sharingEnabled': true,
            } as Parameters<typeof entityCollection.find>[0])
            .skip(offset ?? 0)
            .limit(limit ?? 100)
            .toArray();

          const resolved = await Promise.all(
            entities.map(e => resolveEntity(e, 1) as Promise<IEntity<unknown, true>>),
          );

          return resolved.filter(isEntity).map(e => ({
            _id: e._id,
            name: e.name,
            description: e.relatedDigitalEntity.description,
            thumbnailUrl: new URL(
              `/server/${e.settings.preview}`,
              Configuration.Server.PublicURL,
            ).toString(),
            metsUrl: new URL(
              `/dfg-mets-api/entity/${e._id}`,
              Configuration.Server.PublicURL,
            ).toString(),
          }));
        },
        {
          hasValidApiKey: true,
          query: t.Object({
            key: t.String({
              type: 'string',
              description: 'API key for authentication',
            }),
            limit: t.Optional(
              t.Number({
                type: 'number',
                description: 'Maximum number of entities to return',
                default: 100,
              }),
            ),
            offset: t.Optional(
              t.Number({
                type: 'number',
                description: 'Offset for pagination',
              }),
            ),
          }),
          detail: {
            tags: [RouterTags['DFG METS']],
            description:
              'Retrieves a list of entities with DFG METS sharing enabled. Requires valid API key.',
          },
        },
      ),
  );

export default dfgMetsRouter;
