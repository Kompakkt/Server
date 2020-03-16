import { Request, Response } from 'express';
import { Db, ObjectId } from 'mongodb';
import * as nodemailer from 'nodemailer';

import { IUserData } from '../interfaces';
import { Configuration } from './configuration';
import { Logger } from './logger';
import { Mongo, updateOne } from './mongo';

interface IMailer {
  isConfigValid(): any;
  sendMailRequest(request: Request, response: Response): Promise<any>;
  sendMail(mail: {
    from: string;
    to: string;
    subject: string;
    text: string;
  }): Promise<any>;
  addUserToDatabase(request: Request, mailSent: boolean): any;
  countUserMails(request: Request, destination: string): Promise<number>;
  getMailRelatedDatabaseEntries(_: Request, response: Response): Promise<any>;
  toggleMailAnswered(request: Request, response: Response): Promise<any>;
}

enum ETarget {
  contact = 'contact',
  upload = 'upload',
  bugreport = 'bugreport',
}

interface ISendMailRequest {
  subject?: string;
  mailbody?: string;
  target?: ETarget;
}

interface IMailEntry {
  _id: string | ObjectId;
  target: string;
  content: {
    mailbody: string;
    subject: string;
  };
  timestamp: string;
  user: IUserData;
  answered: boolean;
  mailSent: boolean;
}

const transporter = nodemailer.createTransport({
  host: Configuration.Mailer.Host,
  port: Configuration.Mailer.Port,
});

const Mailer: IMailer = {
  isConfigValid: () => {
    return (
      Configuration.Mailer &&
      Configuration.Mailer.Host &&
      Configuration.Mailer.Port &&
      Configuration.Mailer.Target
    );
  },
  sendMail: async mail => transporter.sendMail(mail),
  sendMailRequest: async (request, response): Promise<any> => {
    if (
      !request.body ||
      !Configuration.Mailer.Target ||
      !(Configuration.Mailer.Target as any)[request.body.target]
    ) {
      return response.send({
        status: 'error',
        message: 'Server mail config invalid',
      });
    }

    const body = request.body as ISendMailRequest;
    if (!body.target || !body.mailbody || !body.subject) {
      return response.send({ status: 'error', message: 'Incomplete request' });
    }

    const mailOptions = {
      from: Configuration.Mailer.Target[body.target],
      to: Configuration.Mailer.Target[body.target],
      subject: body.subject,
      text: body.mailbody,
    };

    const unansweredMails = await Mailer.countUserMails(request, body.target);
    switch (body.target) {
      case ETarget.contact:
        if (unansweredMails >= 3) {
          return response.send({
            status: 'error',
            message: 'Limit for this category reached.',
          });
        }
        break;
      case ETarget.upload:
        if (unansweredMails > 0) {
          return response.send({
            status: 'error',
            message: 'User already requested upload rights.',
          });
        }
        break;
      case ETarget.bugreport:
      default:
    }

    let result = true;

    await Mailer.sendMail(mailOptions)
      .then(success => {
        Logger.info(`Nodemailer sent mail:`, success);
        response.send({ status: 'ok', message: 'Mail has been sent' });
      })
      .catch(error => {
        result = false;
        Logger.err(`Failed sending mail:`, error);
        response.send({ status: 'error', message: 'Failed sending mail' });
      });

    Mailer.addUserToDatabase(request, result).catch(() => {});
  },
  addUserToDatabase: async (request, mailSent) => {
    const target = request.body.target;
    if (
      !Configuration.Mailer.Target ||
      !Object.keys(Configuration.Mailer.Target).includes(target)
    )
      return;

    const AccDb: Db = Mongo.getAccountsRepository();
    const users = AccDb.collection('users');
    const user = await users.findOne({ sessionID: request.sessionID });
    const collection = AccDb.collection(target);

    const subject = request.body.subject;
    const mailbody = request.body.mailbody;
    const document = {
      target,
      content: { mailbody, subject },
      timestamp: new Date().toISOString(),
      user,
      answered: false,
      mailSent,
    };

    const insertResult = await collection.insertOne(document);
    if (insertResult.result.ok !== 1) {
      Logger.info(`Failed adding user to mail database`);
    } else {
      Logger.info(`Added user to DB ${document}`);
    }
  },
  countUserMails: async (request, destination) => {
    const AccDb: Db = Mongo.getAccountsRepository();
    const users = AccDb.collection('users');
    const user = await users.findOne({ sessionID: request.sessionID });
    const collection = AccDb.collection<IMailEntry>(destination);
    const entries = (await collection.find({}).toArray()).filter(
      entry =>
        !entry.answered && entry.user._id.toString() === user._id.toString(),
    );
    return entries.length;
  },
  getMailRelatedDatabaseEntries: async (_, response): Promise<any> => {
    const AccDb: Db = Mongo.getAccountsRepository();
    if (!Configuration.Mailer.Target) {
      return response.send({
        status: 'error',
        message: 'Mailing service not configured',
      });
    }
    const targets = Object.keys(Configuration.Mailer.Target);
    const _res: any = {};
    for (const target of targets) {
      const coll = AccDb.collection(target);
      const all = await coll.find({}).toArray();
      _res[target] = all;
    }
    response.send({ status: 'ok', ..._res });
  },
  toggleMailAnswered: async (request, response): Promise<any> => {
    const target = request.params.target;
    const identifier = request.params.identifier;
    if (!Configuration.Mailer.Target) {
      return response.send({
        status: 'error',
        message: 'Mailing service not configured',
      });
    }
    if (!Object.keys(Configuration.Mailer.Target).includes(target)) {
      return response.send({ status: 'error', message: 'Invalid target' });
    }
    if (!ObjectId.isValid(identifier)) {
      return response.send({
        status: 'error',
        message: 'Invalid mail identifier',
      });
    }
    const _id = new ObjectId(identifier);
    const AccDB: Db = Mongo.getAccountsRepository();
    const targetColl = AccDB.collection(target);
    const oldEntry = await targetColl.findOne({ _id });
    if (!oldEntry || oldEntry.answered === undefined) {
      return response.send({
        status: 'error',
        message: 'Invalid mail entry in database',
      });
    }
    const isAnswered = oldEntry.answered;
    const updateResult = await updateOne(
      targetColl,
      { _id },
      { $set: { answered: !isAnswered } },
    );
    if (updateResult.result.ok !== 1) {
      return response.send({
        status: 'error',
        message: 'Failed updating entry',
      });
    }
    response.send({ status: 'ok', ...(await targetColl.findOne({ _id })) });
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
