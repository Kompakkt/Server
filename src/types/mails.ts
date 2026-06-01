import { t, type UnwrapSchema } from 'elysia';

export enum ETarget {
  contact = 'contact',
  upload = 'upload',
  bugreport = 'bugreport',
}

export const MailCollectionSchema = t.Object(
  {
    target: t.Enum(ETarget),
    content: t.Object({
      subject: t.String(),
      mailbody: t.String(),
    }),
    timestamp: t.String(),
    user: t.String(),
    answered: t.Boolean(),
    mailSent: t.Boolean(),
  },
  {
    additionalProperties: true,
  },
);
export type IMailCollection = UnwrapSchema<typeof MailCollectionSchema>;

export type ISendMailRequest = {
  subject: string;
  mailbody: string;
  target: ETarget;
};

export const isMailTarget = (obj: any): obj is ETarget => {
  return obj === 'contact' || obj === 'upload' || obj === 'bugreport';
};

export const isSendMailRequest = (obj: any): obj is ISendMailRequest => {
  return (
    !!obj &&
    obj.subject !== undefined &&
    obj.mailbody !== undefined &&
    obj.target !== undefined &&
    isMailTarget(obj.target)
  );
};
