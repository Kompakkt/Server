import { UserRank } from 'src/common';
import { Configuration } from 'src/configuration';
import { adminDigest } from 'src/mail-templates';
import { sendJSXMail } from 'src/mailer';
import { userCollection } from 'src/mongo';

export const adminDigestMail = async () => {
  let senderDomain = new URL(Configuration.Server.PublicURL).host;
  if (senderDomain.includes('localhost')) senderDomain = 'kompakkt.de';

  const admins = await userCollection.find({ role: UserRank.admin }).toArray();
  const mails = admins.map(a => a.mail.trim()).filter(mail => !!mail);

  sendJSXMail({
    jsx: await adminDigest('Server has been restarted'),
    from: `noreply@${senderDomain}`,
    to: mails,
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
          to: mails,
          subject: 'Kompakkt Admin Digest [Weekly]',
          maxWidth: 1280,
        });
      },
      7 * 24 * 60 * 60 * 1000,
    );
  }, timeUntilNextMonday);
};
