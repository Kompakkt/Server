import { randomBytes } from "crypto";
import Elysia from "elysia";
import { mongoClient } from "src/mongo";
import configServer from "src/server.config";

const wikibaseRouter = new Elysia().use(configServer)
    .post('/admin/generateWikiSecret', async () => {
        const coll = mongoClient.db('wikibase').collection<{ secret: string }>('wikisecrets');
        const wikiSecret = await coll.findOne({});
        if (!wikiSecret) {
            const secret = randomBytes(32).toString('base64');
            await coll.insertOne({ secret });
            return secret;
        }
        return wikiSecret.secret;
    }, {})
    .post('/admin/repairannotations', () => {}, {})

export default wikibaseRouter