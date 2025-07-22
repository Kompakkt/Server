import { SAML } from '@node-saml/node-saml';
import Elysia from 'elysia';
import configServer from 'src/server.config';
import { getSAMLConfig } from './config';
import { log } from 'src/logger';

const ssoNFDI4CultureRouter = new Elysia()
  .use(configServer)
  .get('/auth/saml/health', () => {
    return { status: 'OK', message: 'SAML authentication service is running' };
  })
  .get('/auth/saml', async ({ redirect }) => {
    const samlService = new SAML(await getSAMLConfig());
    const authUrl = await samlService.getAuthorizeUrlAsync('', '', {});
    return redirect(authUrl);
  })
  .post('/auth/saml/callback', async ({ redirect, body }) => {
    const samlService = new SAML(await getSAMLConfig());
    const result = await samlService.validatePostResponseAsync(body as any);
    log(result, result?.profile?.getSamlResponseXml?.());
    return redirect('/');
  });

export default ssoNFDI4CultureRouter;
