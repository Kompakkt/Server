import { Configuration } from 'src/configuration';
import { warn } from 'src/logger';
import { adminDigest } from 'src/mail-templates';
import { sendJSXMail } from 'src/mailer';

export const adminDigestMail = async () => {
  const contact = Configuration.Mailer?.Target.contact;
  if (!contact) {
    warn('No contact mail configured, skipping admin digest mail job');
    return;
  }

  const senderDomain = contact.split('@').at(1);
  if (!senderDomain) {
    warn('No valid contact mail configured, skipping admin digest mail job');
    return;
  }

  sendJSXMail({
    jsx: await adminDigest('Server has been restarted'),
    from: `noreply@${senderDomain}`,
    to: contact,
    subject: 'Kompakkt Admin Digest [Server Restart]',
    maxWidth: 1280,
  });

  // Get time until next monday 00:00
  const now = new Date();
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
  nextMonday.setHours(0, 0, 0, 0);
  const timeUntilNextMonday = nextMonday.getTime() - now.getTime();

  // Start interval to send mail every week
  setTimeout(() => {
    setInterval(
      () => {
        sendJSXMail({
          jsx: adminDigest(),
          from: `noreply@${senderDomain}`,
          to: contact,
          subject: 'Kompakkt Admin Digest [Weekly]',
          maxWidth: 1280,
        });
      },
      7 * 24 * 60 * 60 * 1000,
    );
  }, timeUntilNextMonday);
};
