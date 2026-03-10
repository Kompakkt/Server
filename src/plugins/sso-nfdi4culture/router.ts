import { SAML } from '@node-saml/node-saml';
import Elysia, { Cookie, t } from 'elysia';
import { ObjectId } from 'mongodb';
import { log, warn } from 'src/logger';
import { userCollection } from 'src/mongo';
import configServer from 'src/server.config';
import { getSAMLConfig } from './config';
import { samlProfileToUser } from './saml';
import { createNewUserProfile } from 'src/util/create-new-user-profile';

const handleSAMLCallback = async ({
  redirect,
  body,
  status,
  request,
  cookie: { auth },
  jwt,
}: {
  redirect: (url: string) => Response;
  body: { SAMLResponse: string };
  status: (code: number, message?: string) => any;
  request: Request;
  cookie: Record<string, Cookie<unknown>>;
  jwt: { sign: (payload: any) => any };
}) => {
  const samlService = new SAML(await getSAMLConfig());
  const result = await samlService.validatePostResponseAsync(body);
  if (!result || !result.profile) return status(401, 'Invalid SAML response');

  const user = samlProfileToUser(result.profile);
  if (!user) return status(401, 'Failed to extract user from SAML response');

  const { username, mail, strategy } = user;

  log(`${user.fullname} logging in using SSO-NFDI4Culture SAML strategy`);

  const userdata = await (async () => {
    const resolvedUser = await userCollection.findOne({ username, mail, strategy });
    if (!resolvedUser) {
      log(`${user.fullname} is not registered yet. Creating new account...`);
      const userProfile = await createNewUserProfile(user).catch(err => {
        warn('Error creating user profile for new user:', err);
        return null;
      });
      if (!userProfile) {
        return status(500, 'Failed creating user profile');
      }
      user.profiles.push(userProfile);

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
};

const ssoNFDI4CultureRouter = new Elysia()
  .use(configServer)
  .post('/user-management/auth/saml/callback', async context => await handleSAMLCallback(context), {
    body: t.Object({ SAMLResponse: t.String() }),
  })
  .get('/sso-nfdi4culture/saml/health', () => {
    return { status: 'OK', message: 'SAML authentication service is running' };
  })
  .get('/sso-nfdi4culture/saml', async ({ redirect }) => {
    const samlService = new SAML(await getSAMLConfig());
    const authUrl = await samlService.getAuthorizeUrlAsync('', '', {});
    return redirect(authUrl);
  })
  .post('/sso-nfdi4culture/saml/callback', async context => await handleSAMLCallback(context), {
    body: t.Object({ SAMLResponse: t.String() }),
  });

export default ssoNFDI4CultureRouter;
