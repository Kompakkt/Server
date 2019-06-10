import * as nodemailer from 'nodemailer';
import { Db, ObjectId } from 'mongodb';

import { Configuration } from './configuration';
import { Logger } from './logger';
import { Mongo } from './mongo';

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

    const MailCount = await Mailer.countUserMails(request, request.body.target);
    // TODO: configurable limits
    switch (request.body.target) {
      case 'bugreport':
        break;
      default:
        if (MailCount < 3) break;
        response.send({ status: 'error', message: 'Limit for this category reached' });
        return;
    }

    transporter.sendMail(mailOptions)
      .then(success => {
        Logger.info(`Nodemailer sent mail:`, success);
        Mailer.addUserToDatabase(request, true);
        response.send({ status: 'ok', message: 'Mail has been sent' });
      })
      .catch(error => {
        Logger.err(`Failed sending mail:`, error);
        Mailer.addUserToDatabase(request, false);
        response.send({ status: 'error', message: 'Failed sending mail' });
      });
  },
  addUserToDatabase: async (request, mailSent) => {
    const target = request.body.target;
    if (!Object.keys(Configuration.Mailer.Target)
      .includes(target)) return;

    const AccDb: Db = await Mongo.getAccountsRepository();
    const ldap = AccDb.collection('users');
    const user = await ldap.findOne({ sessionID: request.sessionID });
    const collection = AccDb.collection(target);

    const subject = request.body.subject;
    const mailbody = request.body.mailbody;
    const document = {
      target, content: { mailbody, subject },
      timestamp: new Date().toISOString(),
      user, answered: false, mailSent,
    };

    const insertResult = await collection.insertOne(document);
    if (insertResult.result.ok !== 1) {
      Logger.info(`Failed adding user to mail database`);
    } else {
      Logger.info(`Added user to DB ${document}`);
    }
  },
  countUserMails: async (request, destination) => {
    const AccDb: Db = await Mongo.getAccountsRepository();
    const ldap = AccDb.collection('users');
    const user = await ldap.findOne({ sessionID: request.sessionID });
    const collection = AccDb.collection(destination);
    const entries = (await collection.find({})
      .toArray())
      .filter(entry => entry.user._id.toString() === user._id.toString());
    return entries.length;
  },
  getMailRelatedDatabaseEntries: async (_, response) => {
    const AccDb: Db = await Mongo.getAccountsRepository();
    const targets = Object.keys(Configuration.Mailer.Target);
    const Response: any = {};
    for (const target of targets) {
      const coll = AccDb.collection(target);
      const all = await coll.find({})
        .toArray();
      Response[target] = all;
    }
    response.send({ status: 'ok', ...Response });
  },
  toggleMailAnswered: async (request, response) => {
    const target = request.params.target;
    const identifier = request.params.identifier;
    if (!Object.keys(Configuration.Mailer.Target)
      .includes(target)) {
      return response.send({ status: 'error', message: 'Invalid target'});
    }
    if (!ObjectId.isValid(identifier)) {
      return response.send({ status: 'error', message: 'Invalid mail identifier'});
    }
    const _id = new ObjectId(identifier);
    const AccDB: Db = await Mongo.getAccountsRepository();
    const targetColl = AccDB.collection(target);
    const oldEntry = await targetColl.findOne({ _id });
    if (!oldEntry || oldEntry.answered === undefined) {
      return response.send({ status: 'error', message: 'Invalid mail entry in database'});
    }
    const isAnswered = oldEntry.answered;
    const updateResult = await targetColl.updateOne({ _id }, { $set: { answered: !isAnswered }});
    if (updateResult.result.ok !== 1) {
      return response.send({ status: 'error', message: 'Failed updating entry'});
    }
    response.send({ status: 'ok', ...await targetColl.findOne({ _id }) });
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
