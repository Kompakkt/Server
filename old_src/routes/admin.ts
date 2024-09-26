import { Router } from 'express';
import { Express } from '../services/express';
import { Admin } from '../services/admin';

const router = Router();

// Subpath: /admin

// These routes are username and password protected by forcing re-authentication
router.use(Express.authenticate());
router.use(Admin.checkIsAdmin);

// Get detailed information about all users
router.post('/getusers', Admin.getAllUsers);

// Get detailed information about a single user
router.post('/getuser/:identifier', Admin.getUser);

// Change the role of a user (only toggling between uploader and user)
router.post('/promoteuser', Admin.promoteUserToRole);

// Toggle the published state of a specific entity
router.post('/togglepublished', Admin.toggleEntityPublishedState);

// Reset the password of a specific user and send the user a mail
router.post('/resetpassword/:username', Admin.resetUserPassword);

export default router;
