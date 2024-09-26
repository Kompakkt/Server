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
        ({ error, body: { mailbody, subject, target }, userdata }) => {
          return userdata
            ? sendMailRequest(
                {
                  mailbody,
                  subject,
                  target,
                },
                userdata,
              ).catch(() => error('Internal Server Error'))
            : error('Forbidden');
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
        ({ error }) => {
          return getMailRelatedDatabaseEntries().catch(() => error('Internal Server Error'));
        },
        {
          isAdmin: true,
        },
      )
      .post(
        '/toggleanswered/:target/:identifier',
        ({ error, params: { identifier } }) => {
          return toggleMailAnswered(identifier).catch(() => error('Internal Server Error'));
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
