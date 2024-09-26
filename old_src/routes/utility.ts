import { Router } from 'express';
import { Express } from '../services/express';
import { Utility } from '../services/utility';
import { Users } from '../services/db';

const router = Router();

// Subpath: /utility

// These routes are accessible to anyone
// Returns instances where a specific entity is used
router.get('/countentityuses/:identifier', Utility.countEntityUses);

// These routes are username and password protected by forcing re-authentication
// Adds or removes a user as owner of a specific entity
router.post('/applyactiontoentityowner', Express.authenticate(), Utility.applyActionToEntityOwner);

// Only logged-in users with a valid session can access the routes below
router.use(Users.validateSession);

// Finds all owners of a specific entity
router.get('/findentityowners/:identifier', Utility.findAllEntityOwnersRequest);

// Adds an annotationList to a specific entity or compilation
router.post('/moveannotations/:identifier', Utility.addAnnotationsToAnnotationList);

// Find all groups the current user is taking part in
router.get('/finduseringroups', Utility.findUserInGroups);

// Find all compilations the current user is taking part in
router.get('/finduserincompilations', Utility.findUserInCompilations);

// Find all entities where the current user is mentioned
router.get('/finduserinmetadata', Utility.findUserInMetadata);

export default router;
