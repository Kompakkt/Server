import { warn } from 'src/logger';
import { Plugin } from '../plugin-base';
import ssoNFDI4CultureRouter from './router';

const neededEnvironmentVariables = [
  'SAML_CERT_PATH',
  'SAML_KEY_PATH',
  'SAML_ENTRYPOINT',
  'SAML_CALLBACK',
  'SAML_ISSUER',
];

class SSONFDI4CulturePlugin extends Plugin {
  routers = [ssoNFDI4CultureRouter];

  async load(pluginArgs?: unknown): Promise<boolean> {
    return true;
  }

  async verifyShouldLoad(): Promise<boolean> {
    let hasMissingEnvVars = false;
    for (const envVar of neededEnvironmentVariables) {
      if (!process.env[envVar]) {
        warn(`[SSO NFDI4Culture] Missing environment variable ${envVar}`);
        hasMissingEnvVars = true;
      }
    }

    return !hasMissingEnvVars;
  }
}

export default new SSONFDI4CulturePlugin();
