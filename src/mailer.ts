import { ObjectId } from 'mongodb';
import { createTransport, type Transporter, type SendMailOptions } from 'nodemailer';
import { UserRank, type IUserData } from './common';
import { Configuration, isMailConfiguration } from './configuration';
import { err, info } from './logger';
import { mailCollection, userCollection } from './mongo';
import type { ServerDocument } from './util/document-with-objectid-type';
import { wrapInMailBody } from './mail-templates/mail-body.template';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

export enum ETarget {
  contact = 'contact',
  upload = 'upload',
  bugreport = 'bugreport',
}

type ISendMailRequest = {
  subject: string;
  mailbody: string;
  target: ETarget;
};

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

const transporter = (() => {
  if (!isMailConfiguration(Configuration.Mailer)) {
    err(
      `
      Missing or incomplete nodemailer configuration.
      No transporter created.
      Currently: ${JSON.stringify(Configuration.Mailer)}`.trim(),
    );
    return undefined;
  }
  return createTransport({
    host: Configuration.Mailer.Host,
    port: Configuration.Mailer.Port,
  });
})();

export const sendMail = async (mail: SendMailOptions): Promise<boolean> =>
  new Promise<SMTPTransport.SentMessageInfo>((resolve, reject) =>
    transporter
      ? transporter.sendMail(mail, (error, info) => {
          if (error) {
            err(error);
            reject({ err, info });
          }
          resolve(info);
        })
      : reject('No transporter'),
  )
    .then(mailInfo => {
      info(mailInfo);
      return true;
    })
    .catch(error => {
      err(error);
      return true;
    });

export const sendJSXMail = async ({
  from,
  to,
  subject,
  jsx,
}: {
  jsx: JSX.Element;
  from: string;
  to: string;
  subject: string;
}): Promise<boolean> => {
  return sendMail({
    from,
    to,
    subject,
    html: wrapInMailBody({ jsx, subject }),
  });
};

export const sendMailRequest = async (
  obj: ISendMailRequest,
  userdata: ServerDocument<IUserData>,
) => {
  if (!isMailConfiguration(Configuration.Mailer)) {
    throw new Error('Server mail config invalid');
  }

  if (!isSendMailRequest(obj)) {
    throw new Error('Incomplete req');
  }

  const mailOptions = {
    from: Configuration.Mailer.Target[obj.target],
    to: Configuration.Mailer.Target[obj.target],
    subject: obj.subject,
    text: obj.mailbody,
  };

  const unansweredMails = await countUserMails(userdata, obj.target);
  switch (obj.target) {
    case ETarget.contact:
      if (unansweredMails >= 3) {
        throw new Error('You have too many open contact requests!');
      }
      break;
    case ETarget.upload:
      if (unansweredMails > 0) {
        throw new Error('You already requested upload capabilities!');
      }
      break;
    case ETarget.bugreport:
    default:
  }

  const result = await sendMail(mailOptions)
    .then(success => {
      info('Nodemailer sent mail:', success);
      return true;
    })
    .catch(error => {
      err('Failed sending mail:', error);
      return false;
    });

  return addUserToDatabase(obj, userdata, result).catch((e: any) => {
    err('Failed adding users mail request to DB', e);
  });
};

const addUserToDatabase = async (
  obj: ISendMailRequest,
  userdata: ServerDocument<IUserData>,
  mailSent: boolean,
) => {
  if (!isSendMailRequest(obj)) return false;
  const { target } = obj;
  if (!isMailConfiguration(Configuration.Mailer)) return false;

  const user = await userCollection.findOne({ _id: new ObjectId(userdata._id) });
  if (!user) return false;

  if (target === ETarget.upload && user?.role === UserRank.user) {
    await userCollection.updateOne(
      { _id: new ObjectId(userdata._id) },
      { $set: { role: UserRank.uploadrequested } },
    );
  }

  const subject = obj.subject;
  const mailbody = obj.mailbody;
  const document = {
    target,
    content: { mailbody, subject },
    timestamp: new Date().toISOString(),
    user: user._id,
    answered: false,
    mailSent,
  };

  const insertResult = await mailCollection.insertOne(document);
  if (!insertResult) {
    info('Failed adding user to mail database');
    return false;
  } else {
    info(`Added user to DB ${document}`);
    return true;
  }
};

const countUserMails = async (userdata: ServerDocument<IUserData>, target: ETarget) => {
  const user = await userCollection.findOne({ _id: new ObjectId(userdata._id) });
  if (!user) throw new Error('User not found');

  if (!isMailTarget(target)) throw new Error('Invalid target');

  const entries = await mailCollection
    .find({
      answered: false,
      target: target,
      user: { _id: { $in: [user._id, new ObjectId(user._id)] } },
    })
    .toArray();
  return entries?.length ?? -1;
};

export const getMailRelatedDatabaseEntries = async () => {
  if (!isMailConfiguration(Configuration.Mailer)) throw new Error('Mailing service not configured');
  const targets = Object.keys(Configuration.Mailer.Target);
  const entries = await mailCollection.find({}).toArray();
  return { targets, entries };
};

export const toggleMailAnswered = async (identifier: string | ObjectId) => {
  if (!isMailConfiguration(Configuration.Mailer)) throw new Error('Mailing service not configured');

  const _id = new ObjectId(identifier);
  const oldEntry = await mailCollection.findOne({ _id });
  if (!oldEntry || !!oldEntry.answered) throw new Error('Invalid mail entry in database');

  const isAnswered = oldEntry.answered;
  const updateResult = await mailCollection.updateOne(
    { _id },
    {
      $set: { answered: !isAnswered },
    },
  );
  if (!updateResult) throw new Error('Failed updating entry');

  return mailCollection.findOne({ _id });
};
