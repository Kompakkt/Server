import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import * as nodemailer from 'nodemailer';
import { UserRank } from '../common';
import { Configuration, isMailConfiguration } from './configuration';
import { Logger } from './logger';
import { Users, Accounts, query } from './db';

enum ETarget {
  contact = 'contact',
  upload = 'upload',
  bugreport = 'bugreport',
}

interface ISendMailRequest {
  subject: string;
  mailbody: string;
  target: ETarget;
}

const isMailTarget = (obj: any): obj is ETarget => {
  return obj === 'contact' || obj === 'upload' || obj === 'bugreport';
};

const isSendMailRequest = (obj: any): obj is ISendMailRequest => {
  return (
    !!obj &&
    obj.subject !== undefined &&
    obj.mailbody !== undefined &&
    obj.target !== undefined &&
    isMailTarget(obj.target)
  );
};

let transporter: nodemailer.Transporter | undefined;

if (isMailConfiguration(Configuration.Mailer)) {
  transporter = nodemailer.createTransport({
    host: Configuration.Mailer.Host,
    port: Configuration.Mailer.Port,
  });
} else {
  Logger.err(
    `
    Missing or incomplete nodemailer configuration.
    No transporter created.
    Currently: ${JSON.stringify(Configuration.Mailer)}`.trim(),
  );
}

const sendMail = async (mail: nodemailer.SendMailOptions) => transporter?.sendMail(mail);
const sendMailRequest = async (req: Request<any, any, ISendMailRequest>, res: Response) => {
  if (!req.body || !isMailConfiguration(Configuration.Mailer)) {
    res.status(500).send('Server mail config invalid');
    return undefined;
  }

  const { body } = req;
  if (!isSendMailRequest(body)) {
    res.status(400).send('Incomplete req');
    return undefined;
  }

  const mailOptions = {
    from: Configuration.Mailer.Target[body.target],
    to: Configuration.Mailer.Target[body.target],
    subject: body.subject,
    text: body.mailbody,
  };

  const unansweredMails = await countUserMails(req, body.target);
  switch (body.target) {
    case ETarget.contact:
      if (unansweredMails >= 3) {
        res.status(409).send('You have too many open contact requests!');
        return undefined;
      }
      break;
    case ETarget.upload:
      if (unansweredMails > 0) {
        res.status(409).send('You already requested upload capabilities!');
        return undefined;
      }
      break;
    case ETarget.bugreport:
    default:
  }

  const result = await sendMail(mailOptions)
    .then(success => {
      Logger.info('Nodemailer sent mail:', success);
      res.status(200).end();
      return true;
    })
    .catch(error => {
      Logger.err('Failed sending mail:', error);
      res.status(500).send('Failed sending mail');
      return false;
    });

  return addUserToDatabase(req, result).catch((e: any) => {
    Logger.err('Failed adding users mail request to DB', e);
  });
};

const addUserToDatabase = async (req: Request, mailSent: boolean) => {
  const { body } = req;
  if (!isSendMailRequest(body)) return false;
  const { target } = body;
  if (!isMailConfiguration(Configuration.Mailer)) return false;

  const user = await Users.getBySession(req);
  if (!user) return false;

  if (target === ETarget.upload && user?.role === UserRank.user) {
    await Accounts.users.updateOne(
      { username: user.username, sessionID: user.sessionID },
      { $set: { role: UserRank.uploadrequested } },
    );
  }

  const subject = req.body.subject;
  const mailbody = req.body.mailbody;
  const document = {
    target,
    content: { mailbody, subject },
    timestamp: new Date().toISOString(),
    user: user._id,
    answered: false,
    mailSent,
  };

  const insertResult = await Accounts.mails.insertOne(document);
  if (!insertResult) {
    Logger.info('Failed adding user to mail database');
    return false;
  } else {
    Logger.info(`Added user to DB ${document}`);
    return true;
  }
};

const countUserMails = async (req: Request, target: ETarget) => {
  const user = await Users.getBySession(req);
  if (!user) throw new Error('User not found by session');

  if (!isMailTarget(target)) throw new Error('Invalid target');

  const entries = await Accounts.mails.find({
    answered: false,
    target: target,
    ...query(user._id, 'user._id'),
  });
  return entries?.length ?? -1;
};

const getMailRelatedDatabaseEntries = async (_: Request, res: Response): Promise<any> => {
  if (!isMailConfiguration(Configuration.Mailer))
    return res.status(500).send('Mailing service not configured');
  const targets = Object.keys(Configuration.Mailer.Target);
  res.status(200).send({ targets, entries: await Accounts.mails.findAll() });
};

const toggleMailAnswered = async (req: Request, res: Response): Promise<any> => {
  if (!isMailConfiguration(Configuration.Mailer))
    return res.status(500).send('Mailing service not configured');
  const target = req.params.target;
  const identifier = req.params.identifier;
  if (!isMailTarget(target)) return res.status(400).send('Invalid target');
  if (!ObjectId.isValid(identifier)) return res.status(400).send('Invalid mail identifier');

  const _id = new ObjectId(identifier);
  const oldEntry = await Accounts.mails.findOne(query(_id));
  if (!oldEntry || !!oldEntry.answered)
    return res.status(409).send('Invalid mail entry in database');

  const isAnswered = oldEntry.answered;
  const updateResult = await Accounts.mails.updateOne(query(_id), {
    $set: { answered: !isAnswered },
  });
  if (!updateResult) return res.status(500).send('Failed updating entry');

  res.status(200).send(await Accounts.mails.findOne(query(_id)));
};

const Mailer = {
  sendMail,
  sendMailRequest,
  addUserToDatabase,
  countUserMails,
  getMailRelatedDatabaseEntries,
  toggleMailAnswered,
};

export { Mailer };
