import { UserRank } from 'src/common';
import { Configuration } from 'src/configuration';
import { adminDigestTemplate } from 'src/emails';
import { sendReactMail } from 'src/mailer';
import { userCollection } from 'src/mongo';
import { getMailDomainFromPublicURL } from 'src/util/get-mail-domain';

export const adminDigestMail = async () => {
  const senderDomain = getMailDomainFromPublicURL();

  const admins = await userCollection.find({ role: UserRank.admin }).toArray();
  const mails = admins.map(a => a.mail.trim()).filter(mail => !!mail);

  sendReactMail({
    jsx: await adminDigestTemplate({ reason: 'Server restarted' }),
    from: `noreply@${senderDomain}`,
    to: mails,
    subject: 'Kompakkt Admin Digest [Server Restart]',
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
      async () => {
        sendReactMail({
          jsx: await adminDigestTemplate({ reason: 'Automatic digest every monday' }),
          from: `noreply@${senderDomain}`,
          to: mails,
          subject: 'Kompakkt Admin Digest [Weekly]',
        });
      },
      7 * 24 * 60 * 60 * 1000,
    );
  }, timeUntilNextMonday);
};
