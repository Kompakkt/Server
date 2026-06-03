import Elysia, { t } from 'elysia';
import configServer from 'src/server.config';
import { WikibaseConfiguration } from './config';
import { WikibaseService } from './service';
import {
  WBAnnotationPredicates,
  WBClasses,
  WBLicenses,
  WBPredicates,
  WBValues,
} from './parsed-model';
import { authService } from 'src/routers/handlers/auth.service';

export const wikibaseRouterTag = 'Wikibase';

const wikibaseRouter = new Elysia()
  .use(configServer)
  .get(
    '/wikibase/parsed-model',
    ({ set }) => {
      set.headers['Content-Type'] = 'application/json';
      return {
        WBValues,
        WBPredicates,
        WBAnnotationPredicates,
        WBClasses,
        WBLicenses,
      };
    },
    {
      detail: {
        tags: [wikibaseRouterTag],
        description: 'Endpoint to retrieve the parsed Wikibase model',
      },
    },
  )
  .get(
    '/wikibase/choices/metadata',
    async ({ query: { force } }) => {
      return WikibaseService.getInstance()?.fetchMetadataChoices(force ?? false);
    },
    {
      query: t.Object({
        force: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: [wikibaseRouterTag],
        description: 'Endpoint to retrieve choices for Wikibase metadata fields used in frontend',
      },
    },
  )
  .get(
    '/wikibase/choices/annotation-link',
    async ({ query: { force } }) => {
      return WikibaseService.getInstance()?.fetchAnnotationLinkChoices(force ?? false);
    },
    {
      query: t.Object({
        force: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: [wikibaseRouterTag],
        description: 'Endpoint to retrieve choices for annotation link fields used in frontend',
      },
    },
  )
  .get(
    '/wikibase/instance/info',
    async () => {
      return {
        instance: WikibaseConfiguration?.Public ?? WikibaseConfiguration?.Domain,
      };
    },
    {
      detail: {
        tags: [wikibaseRouterTag],
        description: 'Endpoint to retrieve basic information about the Wikibase instance',
      },
    },
  );

export default wikibaseRouter;
