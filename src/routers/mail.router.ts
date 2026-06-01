import { Elysia, t } from 'elysia';
import { getMailRelatedDatabaseEntries, sendMailRequest, toggleMailAnswered } from 'src/mailer';
import configServer from 'src/server.config';
import { authService } from './handlers/auth.service';
import { RouterTags } from './tags';
import { info } from 'src/logger';
import { ETarget, MailCollectionSchema } from 'src/types/mails';

const mailRouter = new Elysia()
  .use(configServer)
  .use(authService)
  .group('/mail', group =>
    group
      .post(
        '/sendmail',
        async ({ status, body: { mailbody, subject, target }, userdata }) => {
          if (!userdata) return status(403, 'Forbidden');
          const result = await sendMailRequest({ mailbody, subject, target }, userdata).catch(
            err => {
              info('Failed to send mail request', err);
              return false;
            },
          );
          if (!result) return status(500, 'Failed to send mail request');
          return result;
        },
        {
          response: {
            200: t.Boolean(),
            403: t.Any(),
            500: t.Any(),
          },
          body: t.Object({
            mailbody: t.String(),
            subject: t.String(),
            target: t.Enum(ETarget),
          }),
          detail: {
            description: 'Send a mail to a target',
            tags: [RouterTags.Mail],
          },
        },
      )
      .post(
        '/getmailentries',
        async ({ status }) => {
          const result = getMailRelatedDatabaseEntries().catch(err => {
            info('Failed to get mail entries', err);
            return undefined;
          });
          if (!result) return status(500, 'Failed to get mail entries');
          return result;
        },
        {
          response: {
            200: t.Object({
              targets: t.Array(t.String()),
              entries: t.Array(MailCollectionSchema),
            }),
            500: t.Any(),
          },
          isAdmin: true,
          detail: {
            description: 'Get all mail entries from the database',
            tags: [RouterTags.Mail, RouterTags.Admin],
          },
        },
      )
      .post(
        '/toggleanswered/:target/:identifier',
        async ({ status, params: { identifier } }) => {
          const result = await toggleMailAnswered(identifier).catch(err => {
            info('Failed to toggle mail answered status', err);
            return undefined;
          });
          if (!result) return status(500, 'Failed to toggle mail answered status');
          return result;
        },
        {
          response: {
            200: MailCollectionSchema,
            500: t.Any(),
          },
          isAdmin: true,
          params: t.Object({
            target: t.String(),
            identifier: t.String(),
          }),
          detail: {
            description: 'Toggle the answered status of a mail entry',
            tags: [RouterTags.Mail, RouterTags.Admin],
          },
        },
      ),
  );
export default mailRouter;
