import { NextFunction, Request, Response } from 'express';

import { Admin } from './services/admin';
import { Cleaning } from './services/cleaning';
import { Express, Server, WebSocket } from './services/express';
import { Mailer } from './services/mailer';
import { Mongo } from './services/mongo';
import { Socket } from './services/socket';
import { Upload } from './services/upload';
import { Utility } from './services/utility';

Mongo.init();

// Check if MongoDB is connected
Server.use(Mongo.isMongoDBConnected);
Server.use(Mongo.fixObjectId);
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

// MongoDB REST API
// GET
// Find document by ID in collection
// http://localhost:8080/api/v1/get/find/Person/5bbf023850c06f445ccab442
Server.get(
  [
    '/api/v1/get/find/:collection/:identifier',
    '/api/v1/get/find/:collection/:identifier/:password',
  ],
  Mongo.getEntityFromCollection,
);
// Return all documents of a collection
Server.get('/api/v1/get/findall/:collection', Mongo.getAllEntitiesFromCollection);
// Return data linked to currently logged in LDAP Account
Server.get(['/api/v1/get/ldata', '/auth'], Mongo.validateLoginSession, Mongo.getCurrentUserData);
// Return a MongoDB ObjectId
Server.get('/api/v1/get/id', Mongo.getUnusedObjectId);

Server.get('/api/v1/get/users', Mongo.validateLoginSession, async (_, res) => {
  const users = await Mongo.getAccountsRepository().collection('users').find({}).toArray();
  res.status(200).send(
    users.map(user => ({
      username: user.username,
      fullname: user.fullname,
      _id: user._id,
    })),
  );
});

Server.get('/api/v1/get/groups', Mongo.validateLoginSession, async (_, res) => {
  const groups = await Mongo.getEntitiesRepository().collection('group').find({}).toArray();
  res.status(200).send(groups);
});

// POST
// Post single document to collection
// http://localhost:8080/api/v1/post/push/person/
Server.post(
  '/api/v1/post/push/:collection',
  Mongo.validateLoginSession,
  Mongo.isAllowedToEdit,
  Mongo.addEntityToCollection,
);
// On user submit
Server.post('/api/v1/post/submit', Mongo.validateLoginSession, Mongo.submit);
// On Screenshot update
Server.post(
  '/api/v1/post/settings/:identifier',
  Mongo.validateLoginSession,
  Mongo.updateEntitySettings,
);
// Remove document from collection
Server.post(
  '/api/v1/post/remove/:collection/:identifier',
  Express.authenticate(),
  Mongo.updateSessionId,
  Mongo.validateLoginSession,
  Mongo.removeEntityFromCollection,
);
// Return search data
Server.post('/api/v1/post/search/:collection', Mongo.searchByTextFilter);
Server.post('/api/v1/post/searchentity/:collection', Mongo.searchByEntityFilter);
// Explore req
Server.post('/api/v1/post/explore', Mongo.explore);

// Publish or unpublish a entity
const userOwnerHandler = (req: Request, res: Response, next: NextFunction) => {
  Mongo.isUserOwnerOfEntity(req, req.body.identifier)
    .then((isOwner): any => {
      if (!isOwner) throw new Error();
      next();
    })
    .catch(() => res.status(403).send('Not owner of entity'));
};
Server.post(
  '/api/v1/post/publish',
  Mongo.validateLoginSession,
  userOwnerHandler,
  Admin.toggleEntityPublishedState,
);

// Upload API
// Upload a file to the server
Server.post(
  '/upload',
  Mongo.validateLoginSession,
  Upload.Multer.single('file'),
  Upload.UploadRequest,
);
// User signals that all necessary files are uploaded
// TODO: Post Upload Cleanup
Server.post('/uploadfinished', Mongo.validateLoginSession, Upload.UploadFinish);
// User signals that upload was cancelled
Server.post('/uploadcancel', Mongo.validateLoginSession, Upload.UploadCancel);
// Metadata
Server.post(
  '/addmetadata',
  Mongo.validateLoginSession,
  Upload.Multer.single('file'),
  Upload.AddMetadata,
);
Server.post(
  '/cancelmetadata',
  Mongo.validateLoginSession,
  Upload.Multer.single('file'),
  Upload.CancelMetadata,
);

// General authentication route
Server.post(['/login', '/login/*'], Express.authenticate({ session: true }), Mongo.addToAccounts);
// Authentication
Server.post('/register', Express.registerUser);
Server.get('/logout', Mongo.validateLoginSession, Mongo.invalidateSession);

// Admin reqs
Server.post(
  '/admin/getusers',
  Express.authenticate(),
  Mongo.updateSessionId,
  Admin.checkIsAdmin,
  Admin.getAllUsers,
);

Server.post(
  '/admin/getuser/:identifier',
  Express.authenticate(),
  Mongo.updateSessionId,
  Admin.checkIsAdmin,
  Admin.getUser,
);

Server.post(
  '/admin/promoteuser',
  Express.authenticate(),
  Mongo.updateSessionId,
  Admin.checkIsAdmin,
  Admin.promoteUserToRole,
);

Server.post(
  '/admin/togglepublished',
  Express.authenticate(),
  Mongo.updateSessionId,
  Admin.checkIsAdmin,
  Admin.toggleEntityPublishedState,
);

Server.post(
  '/admin/resetpassword/:username',
  Express.authenticate(),
  Mongo.updateSessionId,
  Admin.checkIsAdmin,
  Admin.resetUserPassword,
);

// Mailer
Server.post('/sendmail', Mongo.validateLoginSession, Mailer.sendMailRequest);

Server.post(
  '/mailer/getmailentries',
  Express.authenticate(),
  Mongo.updateSessionId,
  Admin.checkIsAdmin,
  Mailer.getMailRelatedDatabaseEntries,
);

Server.post(
  '/mailer/toggleanswered/:target/:identifier',
  Express.authenticate(),
  Mongo.updateSessionId,
  Admin.checkIsAdmin,
  Mailer.toggleMailAnswered,
);

// WebSocket
WebSocket.on('connection', Socket._handler);

// Cleaning
Server.post(
  ['/cleaning/deletenullrefs', '/cleaning/deletenullrefs/:confirm'],
  Express.authenticate(),
  Mongo.updateSessionId,
  Admin.checkIsAdmin,
  Cleaning.deleteNullRefs,
);

Server.post(
  ['/cleaning/deleteunused', '/cleaning/deleteunused/:confirm'],
  Express.authenticate(),
  Mongo.updateSessionId,
  Admin.checkIsAdmin,
  Cleaning.deleteUnusedPersonsAndInstitutions,
);

Server.post(
  ['/cleaning/cleanuploadedfiles', '/cleaning/cleanuploadedfiles/:confirm'],
  Express.authenticate(),
  Mongo.updateSessionId,
  Admin.checkIsAdmin,
  Cleaning.cleanUploadedFiles,
);

// Utility
// Not locked
Server.get('/utility/countentityuses/:identifier', Utility.countEntityUses);

// Session-locked
Server.get(
  '/utility/findentityowners/:identifier',
  Mongo.validateLoginSession,
  Utility.findAllEntityOwnersRequest,
);

Server.post(
  '/utility/moveannotations/:identifier',
  Mongo.validateLoginSession,
  Utility.addAnnotationsToAnnotationList,
);

Server.post(
  '/utility/applyactiontoentityowner',
  Express.authenticate(),
  Mongo.updateSessionId,
  Utility.applyActionToEntityOwner,
);

Server.get('/utility/finduseringroups', Mongo.validateLoginSession, Utility.findUserInGroups);

Server.get(
  '/utility/finduserincompilations',
  Mongo.validateLoginSession,
  Utility.findUserInCompilations,
);

Server.get('/utility/finduserinmetadata', Mongo.validateLoginSession, Utility.findUserInMetadata);

// Test Route
Server.get('/test/:collection', Mongo.test);

Express.startListening();
