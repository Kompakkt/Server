import { Configuration } from 'src/configuration';

export const getMailDomainFromPublicURL = () => {
  let senderDomain = new URL(Configuration.Server.PublicURL).host;
  if (senderDomain.includes('localhost')) senderDomain = 'kompakkt.de';
  return senderDomain;
};

export const getMailDomainFromTarget = () => {
  let senderDomain = Configuration.Mailer?.Target?.contact.split('@')[1] || 'kompakkt.de';
  if (senderDomain.includes('localhost')) senderDomain = 'kompakkt.de';
  return senderDomain;
};
