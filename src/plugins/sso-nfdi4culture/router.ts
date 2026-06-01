import { SAML } from '@node-saml/node-saml';
import Elysia, { Cookie, t } from 'elysia';
import { ObjectId } from 'mongodb';
import { log, warn } from 'src/logger';
import { userCollection } from 'src/mongo';
import configServer from 'src/server.config';
import { getSAMLConfig } from './config';
import { samlProfileToUser } from './saml';
import { createNewUserProfile } from 'src/util/create-new-user-profile';
import { pluginCache } from 'src/redis';

export const SSONFDI4CultureRouterTag = 'SSO NFDI4Culture';

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
  .get(
    '/sso-nfdi4culture/actions/register',
    async ({ query: { token, action }, status }) => {
      try {
        const decoded = Buffer.from(action, 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);
        if (typeof parsed !== 'object' || parsed === null) {
          throw new Error('Parsed action is not an object');
        }
      } catch {
        return status(400, 'Invalid action format. Must be a Base64 encoded JSON string.');
      }

      await pluginCache.set(`sso-nfdi4culture::action::${token}`, action, 3600);
      return { status: 'OK', message: `Action registered for token ${token}` };
    },
    {
      query: t.Object({
        token: t.String(),
        action: t.String(),
      }),
      detail: {
        tags: [SSONFDI4CultureRouterTag],
        description:
          'Registers an action for a given token, which can be retrieved later. The action must be a Base64 encoded JSON string. Used internally for handling user intention during the SAML authentication flow.',
      },
    },
  )
  .get(
    '/sso-nfdi4culture/actions/retrieve',
    async ({ query: { token }, status }) => {
      const action = await pluginCache.get<string>(`sso-nfdi4culture::action::${token}`);
      if (!action) {
        return status(404, 'No action found for the provided token');
      }
      await pluginCache.del(`sso-nfdi4culture::action::${token}`);
      return { status: 'OK', action };
    },
    {
      query: t.Object({
        token: t.String(),
      }),
      detail: {
        tags: [SSONFDI4CultureRouterTag],
        description:
          "Retrieves and deletes the action associated with the given token. Used internally after the SAML authentication flow to determine the user's intended action.",
      },
    },
  )
  .get(
    '/sso-nfdi4culture/saml/health',
    () => {
      return { status: 'OK', message: 'SAML authentication service is running' };
    },
    {
      detail: {
        tags: [SSONFDI4CultureRouterTag],
        description: 'Health check endpoint for the SAML authentication service.',
      },
    },
  )
  .get(
    '/sso-nfdi4culture/saml',
    async ({ redirect }) => {
      const samlService = new SAML(await getSAMLConfig());
      const authUrl = await samlService.getAuthorizeUrlAsync('', '', {});
      return redirect(authUrl);
    },
    {
      detail: {
        tags: [SSONFDI4CultureRouterTag],
        description:
          "Initiates the SAML authentication flow by redirecting the user to the Identity Provider's login page.",
      },
    },
  )
  .post('/user-management/auth/saml/callback', async context => await handleSAMLCallback(context), {
    body: t.Object({ SAMLResponse: t.String() }),
    detail: {
      tags: [SSONFDI4CultureRouterTag],
      description:
        'Callback endpoint for SAML authentication. This is the endpoint that the Identity Provider will redirect to after the user has authenticated. It processes the SAML response, logs the user in, and redirects them to the homepage.',
    },
  })
  .post('/sso-nfdi4culture/saml/callback', async context => await handleSAMLCallback(context), {
    body: t.Object({ SAMLResponse: t.String() }),
    detail: {
      tags: [SSONFDI4CultureRouterTag],
      description:
        'Callback endpoint for SAML authentication. This is the endpoint that the Identity Provider will redirect to after the user has authenticated. It processes the SAML response, logs the user in, and redirects them to the homepage.',
    },
  });

export default ssoNFDI4CultureRouter;
