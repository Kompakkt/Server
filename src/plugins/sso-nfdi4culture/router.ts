import { SAML } from '@node-saml/node-saml';
import Elysia, { t } from 'elysia';
import configServer from 'src/server.config';
import { getSAMLConfig } from './config';
import { log } from 'src/logger';
import { samlProfileToUser } from './saml';
import { userCollection } from 'src/mongo';
import { ObjectId } from 'mongodb';

const ssoNFDI4CultureRouter = new Elysia()
  .use(configServer)
  .post(
    '/user-management/auth/saml/callback',
    ({ body, headers }) => {
      return Bun.fetch('http://localhost:3030/server/sso-nfdi4culture/saml/callback', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: JSON.parse(JSON.stringify(headers)),
      });
    },
    {
      body: t.Object({
        SAMLResponse: t.String(),
      }),
    },
  )
  .get('/sso-nfdi4culture/saml/health', () => {
    return { status: 'OK', message: 'SAML authentication service is running' };
  })
  .get('/sso-nfdi4culture/saml', async ({ redirect }) => {
    const samlService = new SAML(await getSAMLConfig());
    const authUrl = await samlService.getAuthorizeUrlAsync('', '', {});
    return redirect(authUrl);
  })
  .post(
    '/sso-nfdi4culture/saml/callback',
    async ({ redirect, body, status, request, cookie: { auth }, jwt }) => {
      const samlService = new SAML(await getSAMLConfig());
      const result = await samlService.validatePostResponseAsync(body);
      if (!result || !result.profile) return status(401, 'Invalid SAML response');

      const user = samlProfileToUser(result.profile);
      if (!user) return status(401, 'Failed to extract user from SAML response');

      const { username, mail } = user;

      log(`${user.fullname} logging in using SSO-NFDI4Culture SAML strategy`);

      const userdata = await (async () => {
        const resolvedUser = await userCollection.findOne({ username, mail });
        if (!resolvedUser) {
          log(`${user.fullname} is not registered yet. Creating new account...`);
          const insertResult = await userCollection.insertOne({
            ...user,
            _id: new ObjectId(),
          });
          if (!insertResult.acknowledged) {
            return false;
          }

          const insertedUser = await userCollection.findOne({ _id: insertResult.insertedId });
          if (!insertedUser) {
            return false;
          }
          return insertedUser;
        }
        return resolvedUser;
      })();
      if (!userdata) return status(500, 'Failed to retrieve or create user');

      const origin = request.headers.get('origin') ?? '';
      const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');

      auth.set({
        value: await jwt.sign({ username: userdata.username, _id: userdata._id.toString() }),
        path: '/',
        httpOnly: true,
        sameSite: isLocalhost ? 'none' : 'lax',
        secure: isLocalhost ? true : undefined,
      });

      return redirect('/');
    },
    {
      body: t.Object({
        SAMLResponse: t.String(),
      }),
    },
  );

export default ssoNFDI4CultureRouter;
