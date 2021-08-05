import DBClient from './services/db/client';
import Entities from './services/db/entities';
import Users from './services/db/users';
import { Admin } from './services/admin';
import { Cleaning } from './services/cleaning';
import { Express, Server, WebSocket } from './services/express';
import { Mailer } from './services/mailer';
import { Socket } from './services/socket';
import { Upload } from './services/upload';
import { Utility } from './services/utility';

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

// MongoDB REST API
// GET
// Find document by ID in collection
// http://localhost:8080/api/v1/get/find/Person/5bbf023850c06f445ccab442
Server.get(
  [
    '/api/v1/get/find/:collection/:identifier',
    '/api/v1/get/find/:collection/:identifier/:password',
  ],
  Entities.getEntityFromCollection,
);
// Return all documents of a collection
Server.get('/api/v1/get/findall/:collection', Entities.getAllEntitiesFromCollection);
// Return data linked to currently logged in LDAP Account
Server.get(['/api/v1/get/ldata', '/auth'], Users.validateSession, Users.getCurrentUserData);
// Return a MongoDB ObjectId
Server.get('/api/v1/get/id', DBClient.getUnusedObjectId);

Server.get('/api/v1/get/users', Users.validateSession, Users.getStrippedUsers);

Server.get('/api/v1/get/groups', Users.validateSession, async (_, res) => {
  return res.status(200).send(await Entities.findAll('group'));
});

// POST
// Post single document to collection
// http://localhost:8080/api/v1/post/push/person/
Server.post(
  '/api/v1/post/push/:collection',
  Users.validateSession,
  Users.isAllowedToEdit,
  Entities.addEntityToCollection,
);
// On user submit
Server.post('/api/v1/post/submit', Users.validateSession, Entities.submit);
// On Screenshot update
Server.post(
  '/api/v1/post/settings/:identifier',
  Users.validateSession,
  Entities.updateEntitySettings,
);
// Remove document from collection
Server.post(
  '/api/v1/post/remove/:collection/:identifier',
  Express.authenticate(),
  //  Users.updateSessionId,
  Users.validateSession,
  Entities.removeEntityFromCollection,
);
// Return search data
Server.post('/api/v1/post/search/:collection', Entities.searchByTextFilter);
Server.post('/api/v1/post/searchentity/:collection', Entities.searchByEntityFilter);
// Explore req
Server.post('/api/v1/post/explore', Entities.explore);

// Publish or unpublish a entity
Server.post(
  '/api/v1/post/publish',
  Users.validateSession,
  Users.isOwnerMiddleware,
  Admin.toggleEntityPublishedState,
);

// Upload API
// Upload a file to the server
Server.post('/upload', Users.validateSession, Upload.fileUploadRequestHandler, Upload.send);
// User signals that all necessary files are uploaded
// TODO: Post Upload Cleanup
Server.post('/uploadfinished', Users.validateSession, Upload.finish);
// User signals that upload was cancelled
Server.post('/uploadcancel', Users.validateSession, Upload.cancel);

// General authentication route
Server.post(['/login', '/login/*'], Express.authenticate({ session: true }), Users.login);
// Authentication
Server.post('/register', Express.registerUser);
Server.get('/logout', Users.validateSession, Users.logout);

// Admin reqs
Server.post(
  '/admin/getusers',
  Express.authenticate(),
  // Mongo.updateSessionId,
  Admin.checkIsAdmin,
  Admin.getAllUsers,
);

Server.post(
  '/admin/getuser/:identifier',
  Express.authenticate(),
  // Mongo.updateSessionId,
  Admin.checkIsAdmin,
  Admin.getUser,
);

Server.post(
  '/admin/promoteuser',
  Express.authenticate(),
  // Mongo.updateSessionId,
  Admin.checkIsAdmin,
  Admin.promoteUserToRole,
);

Server.post(
  '/admin/togglepublished',
  Express.authenticate(),
  // Mongo.updateSessionId,
  Admin.checkIsAdmin,
  Admin.toggleEntityPublishedState,
);

Server.post(
  '/admin/resetpassword/:username',
  Express.authenticate(),
  // Mongo.updateSessionId,
  Admin.checkIsAdmin,
  Admin.resetUserPassword,
);

// Mailer
Server.post('/sendmail', Users.validateSession, Mailer.sendMailRequest);

Server.post(
  '/mailer/getmailentries',
  Express.authenticate(),
  // Mongo.updateSessionId,
  Admin.checkIsAdmin,
  Mailer.getMailRelatedDatabaseEntries,
);

Server.post(
  '/mailer/toggleanswered/:target/:identifier',
  Express.authenticate(),
  // Mongo.updateSessionId,
  Admin.checkIsAdmin,
  Mailer.toggleMailAnswered,
);

// WebSocket
WebSocket.on('connection', Socket._handler);

// Cleaning
Server.post(
  ['/cleaning/deletenullrefs', '/cleaning/deletenullrefs/:confirm'],
  Express.authenticate(),
  // Mongo.updateSessionId,
  Admin.checkIsAdmin,
  Cleaning.deleteNullRefs,
);

Server.post(
  ['/cleaning/deleteunused', '/cleaning/deleteunused/:confirm'],
  Express.authenticate(),
  // Mongo.updateSessionId,
  Admin.checkIsAdmin,
  Cleaning.deleteUnusedPersonsAndInstitutions,
);

Server.post(
  ['/cleaning/cleanuploadedfiles', '/cleaning/cleanuploadedfiles/:confirm'],
  Express.authenticate(),
  // Mongo.updateSessionId,
  Admin.checkIsAdmin,
  Cleaning.cleanUploadedFiles,
);

// Utility
// Not locked
Server.get('/utility/countentityuses/:identifier', Utility.countEntityUses);

// Session-locked
Server.get(
  '/utility/findentityowners/:identifier',
  Users.validateSession,
  Utility.findAllEntityOwnersRequest,
);

Server.post(
  '/utility/moveannotations/:identifier',
  Users.validateSession,
  Utility.addAnnotationsToAnnotationList,
);

Server.post(
  '/utility/applyactiontoentityowner',
  Express.authenticate(),
  // Mongo.updateSessionId,
  Utility.applyActionToEntityOwner,
);

Server.get('/utility/finduseringroups', Users.validateSession, Utility.findUserInGroups);

Server.get(
  '/utility/finduserincompilations',
  Users.validateSession,
  Utility.findUserInCompilations,
);

Server.get('/utility/finduserinmetadata', Users.validateSession, Utility.findUserInMetadata);

// Test Route
Server.get('/test/:collection', Entities.test);

Express.startListening();
