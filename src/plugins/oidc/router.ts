import Elysia, { t } from 'elysia';
import { ObjectId } from 'mongodb';
import * as OpenIDClient from 'openid-client';
import { UserRank } from 'src/common';
import { err, log } from 'src/logger';
import { userCollection } from 'src/mongo';
import { RouterTags } from 'src/routers/tags';
import configServer from 'src/server.config';
import { getOIDCConfig } from './config';

const getClientConfig = async () => {
  const config = getOIDCConfig();
  return await OpenIDClient.discovery(
    new URL(config.issuer),
    config.client_id,
    config.client_secret,
  );
};

const oidcRouter = new Elysia()
  .use(configServer)
  .get(
    '/oidc/health',
    () => {
      return { status: 'OK', message: 'OIDC authentication service is running' };
    },
    {
      detail: {
        description: 'Health check endpoint for OIDC authentication service',
        tags: [RouterTags['OIDC Authentication']],
      },
    },
  )
  .get(
    '/oidc/login',
    async ({ redirect, cookie: { oidc_state, oidc_code_verifier } }) => {
      const config = await getClientConfig();
      const oidcConfig = getOIDCConfig();

      const code_verifier = OpenIDClient.randomPKCECodeVerifier();
      const code_challenge = await OpenIDClient.calculatePKCECodeChallenge(code_verifier);
      const state = OpenIDClient.randomState();

      oidc_state.set({ value: state, path: '/', httpOnly: true, maxAge: 300 });
      oidc_code_verifier.set({ value: code_verifier, path: '/', httpOnly: true, maxAge: 300 });

      const parameters: Record<string, string> = {
        redirect_uri: oidcConfig.redirect_uri,
        scope: oidcConfig.scope,
        code_challenge,
        code_challenge_method: 'S256',
        state,
      };

      const redirectTo = OpenIDClient.buildAuthorizationUrl(config, parameters);
      return redirect(redirectTo.href);
    },
    {
      cookie: t.Object({
        oidc_state: t.Optional(t.String()),
        oidc_code_verifier: t.Optional(t.String()),
      }),
      detail: {
        description: 'Initiates OIDC authentication flow',
        tags: [RouterTags['OIDC Authentication']],
      },
    },
  )
  .get(
    '/oidc/callback',
    async ({
      redirect,
      status,
      request,
      cookie: { auth, oidc_state, oidc_code_verifier },
      jwt,
    }) => {
      try {
        const config = await getClientConfig();
        const oidcConfig = getOIDCConfig();

        const tokens = await OpenIDClient.authorizationCodeGrant(config, new URL(request.url), {
          pkceCodeVerifier: oidc_code_verifier.value,
          expectedState: oidc_state.value,
        });

        const userinfo = await OpenIDClient.fetchUserInfo(
          config,
          tokens.access_token,
          tokens.claims()?.sub!,
        );

        const email = userinfo.email as string;
        const username = (userinfo.preferred_username as string) || email;

        if (!email || !username) {
          return status(401, 'Failed to extract user information from OIDC provider');
        }

        const userdata = await (async () => {
          const query = { $or: [{ username }, { mail: email }] };
          const resolvedUser = await userCollection.findOne(query);

          if (!resolvedUser) {
            log(`OIDC: User ${username} not found. Creating new account...`);
            const newUser = {
              username,
              fullname: (userinfo.name as string) || username,
              prename: (userinfo.given_name as string) || '',
              surname: (userinfo.family_name as string) || '',
              mail: email,
              role: UserRank.uploader,
              data: {},
              strategy: 'oidc',
              _id: new ObjectId(),
            };

            const insertResult = await userCollection.insertOne(newUser as any);
            if (!insertResult.acknowledged) return false;
            return newUser;
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

        // Cleanup OIDC cookies
        oidc_state.remove();
        oidc_code_verifier.remove();

        return redirect('/');
      } catch (error) {
        err('OIDC Callback Error:', error);
        return status(401, 'Authentication failed');
      }
    },
    {
      cookie: t.Object({
        oidc_code_verifier: t.Optional(t.String()),
        oidc_state: t.Optional(t.String()),
      }),
      detail: {
        description: 'Callback endpoint for OIDC authentication',
        tags: [RouterTags['OIDC Authentication']],
      },
    },
  );

export default oidcRouter;
