import { warn } from 'src/logger';

const neededEnvironmentVariables = ['OIDC_ISSUER', 'OIDC_CLIENT_ID', 'OIDC_REDIRECT_URI'];

export default async () => {
  let hasMissingEnvVars = false;
  for (const envVar of neededEnvironmentVariables) {
    if (!Bun.env[envVar]) {
      warn(`[OIDC] Missing environment variable ${envVar}`);
      hasMissingEnvVars = true;
    }
  }
  return !hasMissingEnvVars;
};
