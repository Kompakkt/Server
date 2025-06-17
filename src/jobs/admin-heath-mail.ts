import { adminHealth } from 'src/mail-templates';
import { sendJSXMail } from 'src/mailer';

export const adminHealthMail = async () => {
  return sendJSXMail({
    jsx: adminHealth(),
    from: 'noreply@kompakkt.de',
    to: 'contact@kompakkt.de',
    subject: 'Kompakkt Server Health Check',
  });
};
