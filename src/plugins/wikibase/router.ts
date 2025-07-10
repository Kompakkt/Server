import { randomBytes } from 'node:crypto';
import Elysia, { t } from 'elysia';
import { mongoClient } from 'src/mongo';
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

const wikibaseRouter = new Elysia()
  .use(configServer)
  .get('/wikibase/parsed-model', ({ set }) => {
    set.headers['Content-Type'] = 'application/json';
    return {
      WBValues,
      WBPredicates,
      WBAnnotationPredicates,
      WBClasses,
      WBLicenses,
    };
  })
  .get(
    '/wikibase/choices/metadata',
    async ({ query: { force } }) => {
      return WikibaseService.getInstance()?.fetchMetadataChoices(force ?? false);
    },
    {
      query: t.Object({
        force: t.Optional(t.Boolean()),
      }),
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
    },
  )
  .get('/wikibase/instance/info', async () => {
    return {
      instance: WikibaseConfiguration?.Domain,
    };
  })
  .post(
    '/admin/generateWikiSecret',
    async () => {
      const coll = mongoClient.db('wikibase').collection<{ secret: string }>('wikisecrets');
      const wikiSecret = await coll.findOne({});
      if (!wikiSecret) {
        const secret = randomBytes(32).toString('base64');
        await coll.insertOne({ secret });
        return secret;
      }
      return wikiSecret.secret;
    },
    {},
  )
  .post('/admin/repairannotations', () => {}, {});

export default wikibaseRouter;
