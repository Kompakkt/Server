export const getOIDCConfig = () => {
  const { OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_REDIRECT_URI, OIDC_SCOPE } =
    process.env;

  if (!OIDC_ISSUER || !OIDC_CLIENT_ID || !OIDC_REDIRECT_URI) {
    throw new Error(
      'OIDC config is not set (OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_REDIRECT_URI are required)',
    );
  }

  return {
    issuer: OIDC_ISSUER,
    client_id: OIDC_CLIENT_ID,
    client_secret: OIDC_CLIENT_SECRET,
    redirect_uri: OIDC_REDIRECT_URI,
    scope: OIDC_SCOPE || 'openid profile email',
  };
};
