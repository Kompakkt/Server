import { Router } from 'express';
import { Upload } from '../services/upload';
import { Users } from '../services/db';

const router = Router();

// Subpath: /upload

// Only logged-in users with a valid session can access the routes below
router.use(Users.validateSession);

// Upload a single file
// Note: this route will be called once for each file that a user uploads
// during the upload process
router.post('/file', Upload.fileUploadRequestHandler, Upload.send);

// Finishes the upload process by permanently saving the uploaded files
router.post('/finish', Upload.finish);

// Cancels the upload process and removes any saved files
// Note: this route is only available during the upload process
// and relies on the UploadCache
router.post('/cancel', Upload.cancel);

export default router;
