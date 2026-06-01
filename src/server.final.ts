import Elysia from 'elysia';
import adminRouter from './routers/admin.router';
import apiV1Router from './routers/api.v1.router';
import apiV2Router from './routers/api.v2.router';
import mailRouter from './routers/mail.router';
import uploadRouter from './routers/upload.router';
import userManagementRouter from './routers/user-management.router';
import utilityRouter from './routers/utility.router';
import configServer from './server.config';

const finalServer = new Elysia()
  .use(configServer)
  .use(adminRouter)
  .use(userManagementRouter)
  .use(utilityRouter)
  .use(apiV1Router)
  .use(apiV2Router)
  .use(mailRouter)
  .use(uploadRouter);

export default finalServer;
