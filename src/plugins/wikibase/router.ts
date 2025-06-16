import { randomBytes } from 'node:crypto';
import Elysia from 'elysia';
import { mongoClient } from 'src/mongo';
import configServer from 'src/server.config';
import { WikibaseConfiguration } from './config';
import { WikibaseService } from './service';

const wikibaseRouter = new Elysia()
  .use(configServer)
  .get('/wikibase/choices/metadata', async () => {
    return WikibaseService.getInstance()?.fetchMetadataChoices();
  })
  .get('/wikibase/choices/annotation-link', async () => {
    return WikibaseService.getInstance()?.fetchAnnotationLinkChoices();
  })
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
