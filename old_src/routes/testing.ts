import { Router } from 'express';
import { Express } from '../services/express';
import { Admin } from '../services/admin';
import { Entities } from '../services/db';

const router = Router();

// Subpath: /testing

router.use(Express.authenticate());
router.use(Admin.checkIsAdmin);

router.post('/test/:collection', Entities.test);
router.post('/testall', Entities.testAll);

export default router;
