import * as nodemailer from 'nodemailer';

import { Configuration } from './configuration';
import { Logger } from './logger';

const Mailer = {
  isConfigValid: () => {
    return Configuration.Mailer
      && Configuration.Mailer.Host
      && Configuration.Mailer.Port
      && Configuration.Mailer.Target;
  },
  sendMail: async (request, response) => {

    if (!request.body || !Configuration.Mailer.Target[request.body.target]) {
      response.send({ status: 'error' });
      return false;
    }

    const transporter = nodemailer.createTransport({
      host: Configuration.Mailer.Host,
      port: Configuration.Mailer.Port,
    });

    const mailOptions = {
      from: Configuration.Mailer.Target[request.body.target],
      to: Configuration.Mailer.Target[request.body.target],
      subject: request.body.subject,
      text: request.body.mailbody,
    };

    transporter.sendMail(mailOptions)
      .then(success => {
        Logger.info(`Nodemailer sent mail:`, success);
        response.send({ status: 'ok', message: 'Mail has been sent' });
      })
      .catch(error => {
        Logger.err(`Failed sending mail:`, error);
        response.send({ status: 'error', message: 'Failed sending mail' });
      });
  },
};

if (!Mailer.isConfigValid()) {
  Logger.err(`
    Missing or incomplete nodemailer configuration
    Host: ${Configuration.Mailer.Host}
    Port: ${Configuration.Mailer.Port}
    Target from: ${Configuration.Mailer.Target}`);
}

export { Mailer };
