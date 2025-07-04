import { Elysia, t } from 'elysia';
import {
  ETarget,
  getMailRelatedDatabaseEntries,
  sendMailRequest,
  toggleMailAnswered,
} from 'src/mailer';
import configServer from 'src/server.config';
import { authService } from './handlers/auth.service';

const mailRouter = new Elysia()
  .use(configServer)
  .use(authService)
  .group('/mail', group =>
    group
      .post(
        '/sendmail',
        ({ status, body: { mailbody, subject, target }, userdata }) => {
          return userdata
            ? sendMailRequest(
                {
                  mailbody,
                  subject,
                  target,
                },
                userdata,
              ).catch(() => status('Internal Server Error'))
            : status('Forbidden');
        },
        {
          body: t.Object({
            mailbody: t.String(),
            subject: t.String(),
            target: t.Enum(ETarget),
          }),
        },
      )
      .post(
        '/getmailentries',
        async ({ status }) => {
          return getMailRelatedDatabaseEntries().catch(() => status('Internal Server Error'));
        },
        {
          isAdmin: true,
        },
      )
      .post(
        '/toggleanswered/:target/:identifier',
        async ({ status, params: { identifier } }) => {
          return toggleMailAnswered(identifier).catch(() => status('Internal Server Error'));
        },
        {
          isAdmin: true,
          params: t.Object({
            target: t.String(),
            identifier: t.String(),
          }),
        },
      ),
  );
export default mailRouter;
