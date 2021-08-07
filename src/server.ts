import { DBClient } from './services/db';
import { Express, Server, WebSocket } from './services/express';
import { Socket } from './services/socket';

// prettier-ignore
import { AdminRouter, ApiV1Router, CleaningRouter, MailRouter, UploadRouter, UserManagementRouter, UtilityRouter, TestingRouter } from './routes';

// Check if MongoDB is connected
Server.use(DBClient.Middleware.isConnected);
Server.use(DBClient.Middleware.fixObjectId);
Server.use((req, res, next) => {
  if (req.body && req.body.username) {
    // LDAP doesn't care about e.g. whitespaces in usernames
    // so we fix this here
    const regex = new RegExp(/[a-zA-Z0-9äöüÄÖÜß\-\_]/gi);
    const username = `${req.body.username}`;
    const match = username.match(regex);
    if (match) {
      req.body.username = [...match].join('');
      next();
    } else {
      res.status(403).send('Cannot handle username');
    }
  } else {
    next();
  }
});

Server.use('/api/v1', ApiV1Router);
Server.use('/admin', AdminRouter);
Server.use('/cleaning', CleaningRouter);
Server.use('/mail', MailRouter);
Server.use('/upload', UploadRouter);
Server.use('/user-management', UserManagementRouter);
Server.use('/utility', UtilityRouter);
Server.use('/testing', TestingRouter);

// WebSocket
WebSocket.on('connection', Socket._handler);

Express.startListening();
