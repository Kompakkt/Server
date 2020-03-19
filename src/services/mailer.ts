import { Request, Response } from 'express';
import { Db, ObjectId } from 'mongodb';
import * as nodemailer from 'nodemailer';

import { IUserData, EUserRank } from '@kompakkt/shared';
import { Configuration } from './configuration';
import { Logger } from './logger';
import { Mongo, updateOne } from './mongo';

interface IMailer {
  isConfigValid(): any;
  sendMailRequest(req: Request, res: Response): Promise<any>;
  sendMail(mail: {
    from: string;
    to: string;
    subject: string;
    text: string;
  }): Promise<any>;
  addUserToDatabase(req: Request, mailSent: boolean): any;
  countUserMails(req: Request, destination: string): Promise<number>;
  getMailRelatedDatabaseEntries(_: Request, res: Response): Promise<any>;
  toggleMailAnswered(req: Request, res: Response): Promise<any>;
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
  sendMailRequest: async (req, res): Promise<any> => {
    if (
      !req.body ||
      !Configuration.Mailer.Target ||
      !(Configuration.Mailer.Target as any)[req.body.target]
    ) {
      return res.status(500).send('Server mail config invalid');
    }

    const body = req.body as ISendMailRequest;
    if (!body.target || !body.mailbody || !body.subject)
      return res.status(400).send('Incomplete req');

    const mailOptions = {
      from: Configuration.Mailer.Target[body.target],
      to: Configuration.Mailer.Target[body.target],
      subject: body.subject,
      text: body.mailbody,
    };

    const unansweredMails = await Mailer.countUserMails(req, body.target);
    switch (body.target) {
      case ETarget.contact:
        if (unansweredMails >= 3) {
          return res.status(409).send('Limit for this category reached.');
        }
        break;
      case ETarget.upload:
        if (unansweredMails > 0) {
          return res.status(409).send('User already reqed upload rights.');
        }
        break;
      case ETarget.bugreport:
      default:
    }

    let result = true;

    await Mailer.sendMail(mailOptions)
      .then(success => {
        Logger.info(`Nodemailer sent mail:`, success);
        res.status(200).end();
      })
      .catch(error => {
        result = false;
        Logger.err(`Failed sending mail:`, error);
        res.status(500).send('Failed sending mail');
      });

    Mailer.addUserToDatabase(req, result).catch(() => {});
  },
  addUserToDatabase: async (req, mailSent) => {
    const target = req.body.target;
    if (
      !Configuration.Mailer.Target ||
      !Object.keys(Configuration.Mailer.Target).includes(target)
    )
      return;

    const AccDb: Db = Mongo.getAccountsRepository();
    const users = AccDb.collection('users');
    const user = await users.findOne({ sessionID: req.sessionID });
    const collection = AccDb.collection(target);

    if (target === ETarget.upload && user.role === EUserRank.user) {
      await updateOne(
        users,
        { sessionID: req.sessionID },
        { $set: { role: EUserRank.uploadrequested } },
      );
    }

    const subject = req.body.subject;
    const mailbody = req.body.mailbody;
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
  countUserMails: async (req, destination) => {
    const AccDb: Db = Mongo.getAccountsRepository();
    const users = AccDb.collection('users');
    const user = await users.findOne({ sessionID: req.sessionID });
    const collection = AccDb.collection<IMailEntry>(destination);
    const entries = (await collection.find({}).toArray()).filter(
      entry =>
        !entry.answered && entry.user._id.toString() === user._id.toString(),
    );
    return entries.length;
  },
  getMailRelatedDatabaseEntries: async (_, res): Promise<any> => {
    const AccDb: Db = Mongo.getAccountsRepository();
    if (!Configuration.Mailer.Target)
      return res.status(500).send('Mailing service not configured');

    const targets = Object.keys(Configuration.Mailer.Target);
    const result: any = {};
    for (const target of targets) {
      const coll = AccDb.collection(target);
      const all = await coll.find({}).toArray();
      result[target] = all;
    }
    res.status(200).send(result);
  },
  toggleMailAnswered: async (req, res): Promise<any> => {
    const target = req.params.target;
    const identifier = req.params.identifier;
    if (!Configuration.Mailer.Target)
      return res.status(500).send('Mailing service not configured');
    if (!Object.keys(Configuration.Mailer.Target).includes(target))
      return res.status(400).send('Invalid target');
    if (!ObjectId.isValid(identifier))
      return res.status(400).send('Invalid mail identifier');

    const _id = new ObjectId(identifier);
    const AccDB: Db = Mongo.getAccountsRepository();
    const targetColl = AccDB.collection(target);
    const oldEntry = await targetColl.findOne({ _id });
    if (!oldEntry || oldEntry.answered === undefined)
      return res.status(409).send('Invalid mail entry in database');

    const isAnswered = oldEntry.answered;
    const updateResult = await updateOne(
      targetColl,
      { _id },
      { $set: { answered: !isAnswered } },
    );
    if (updateResult.result.ok !== 1)
      return res.status(500).send('Failed updating entry');

    res.status(200).send(await targetColl.findOne({ _id }));
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
