import { Router } from 'express';
import { Express } from '../services/express';
import { Admin } from '../services/admin';
import { Cleaning } from '../services/cleaning';

const router = Router();

// Subpath: /cleaning

// These routes are username and password protected by forcing re-authentication
router.use(Express.authenticate());
router.use(Admin.checkIsAdmin);

// Delete references that are no longer existing
router.post('/deletenullrefs/:confirm?', Cleaning.deleteNullRefs);

// Delete entries that are no longer used
router.post('/deleteunused/:confirm?', Cleaning.deleteUnusedPersonsAndInstitutions);

// Delete files that are not used by any entity
router.post('/cleanuploadedfiles/:confirm?', Cleaning.cleanUploadedFiles);

export default router;
