import { type SamlConfig } from '@node-saml/node-saml';

export const getSAMLConfig = async () => {
  const { SAML_CERT_PATH, SAML_KEY_PATH, SAML_ENTRYPOINT, SAML_CALLBACK, SAML_ISSUER } =
    process.env;
  if (!SAML_CERT_PATH || !SAML_KEY_PATH || !SAML_ENTRYPOINT || !SAML_CALLBACK || !SAML_ISSUER) {
    throw new Error('SAML config is not set');
  }
  const cert = await Bun.file(SAML_CERT_PATH).text();
  const key = await Bun.file(SAML_KEY_PATH).text();

  const SAMLConfig: SamlConfig = {
    callbackUrl: SAML_CALLBACK,
    entryPoint: SAML_ENTRYPOINT,
    issuer: SAML_ISSUER,
    // cert must be provided
    idpCert: cert,
    privateKey: key,
    decryptionPvk: key,
    wantAssertionsSigned: true,
  };
  return SAMLConfig;
};
