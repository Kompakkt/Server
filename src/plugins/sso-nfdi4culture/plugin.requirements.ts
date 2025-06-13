import { warn } from 'src/logger';

const neededEnvironmentVariables = [
  'SAML_CERT_PATH',
  'SAML_KEY_PATH',
  'SAML_ENTRYPOINT',
  'SAML_CALLBACK',
  'SAML_ISSUER',
];

export default async () => {
  let hasMissingEnvVars = false;
  for (const envVar of neededEnvironmentVariables) {
    if (!process.env[envVar]) {
      warn(`[SSO NFDI4Culture] Missing environment variable ${envVar}`);
      hasMissingEnvVars = true;
    }
  }

  return !hasMissingEnvVars;
};
