import { Router } from 'express';
import { Express } from '../services/express';
import { Admin } from '../services/admin';
import { Mailer } from '../services/mailer';
import { Users } from '../services/db';

const router = Router();

// Subpath: /mail

// Send a mail to the server admins
router.post('/send', Users.validateSession, Mailer.sendMailRequest);

// These routes are username and password protected by forcing re-authentication
router.use(Express.authenticate());
router.use(Admin.checkIsAdmin);

// Get all mail entries
router.post('/getmailentries', Mailer.getMailRelatedDatabaseEntries);

// Toggle a mail as answered
router.post('/toggleanswered/:target/:identifier', Mailer.toggleMailAnswered);

export default router;
