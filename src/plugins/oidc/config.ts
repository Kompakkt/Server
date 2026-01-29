export type OIDCAuthType = 'basic' | 'post' | 'jwt';

export const getOIDCConfig = () => {
  const {
    OIDC_ISSUER,
    OIDC_CLIENT_ID,
    OIDC_CLIENT_SECRET,
    OIDC_REDIRECT_URI,
    OIDC_SCOPE,
    OIDC_AUTH_TYPE,
    OIDC_FORCE_HTTPS,
  } = Bun.env;

  if (!OIDC_ISSUER || !OIDC_CLIENT_ID || !OIDC_REDIRECT_URI || !OIDC_CLIENT_SECRET) {
    throw new Error(
      'OIDC config is not set (OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_REDIRECT_URI and OIDC_CLIENT_SECRET are required)',
    );
  }

  let authType = (OIDC_AUTH_TYPE?.toLowerCase() || 'basic') as OIDCAuthType;
  if (authType !== 'basic' && authType !== 'post' && authType !== 'jwt') {
    throw new Error('OIDC_AUTH_TYPE must be one of: basic, post, jwt');
  }

  return {
    issuer: OIDC_ISSUER,
    client_id: OIDC_CLIENT_ID,
    client_secret: OIDC_CLIENT_SECRET,
    redirect_uri: OIDC_REDIRECT_URI,
    oidc_auth_type: authType,
    force_https: OIDC_FORCE_HTTPS?.toLowerCase() === 'true',
    scope: OIDC_SCOPE || 'openid profile email',
  };
};
