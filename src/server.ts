import { NextFunction, Request, Response } from 'express';

import { Admin } from './services/admin';
import { Cleaning } from './services/cleaning';
import { Europeana } from './services/europeana';
import { Express, Server, WebSocket } from './services/express';
import { Mailer } from './services/mailer';
import { Mongo } from './services/mongo';
import { Socket } from './services/socket';
import { Upload } from './services/upload';
import { Utility } from './services/utility';

// Check if MongoDB is connected
Server.use(Mongo.isMongoDBConnected);
Server.use(Mongo.fixObjectId);
Server.use((request, response, next) => {
  if (request.body && request.body.username) {
    // LDAP doesn't care about e.g. whitespaces in usernames
    // so we fix this here
    const regex = new RegExp(/[a-z0-9]+/i);
    const result = request.body.username.match(regex);
    if (result[0]) {
      request.body.username = result[0];
      next();
    } else {
      response.send({ status: 'error', message: 'Cannot handle username' });
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
Server.get(
  '/api/v1/get/findall/:collection',
  Mongo.getAllEntitiesFromCollection,
);
// Return data linked to currently logged in LDAP Account
Server.get(
  ['/api/v1/get/ldata', '/auth'],
  Mongo.validateLoginSession,
  Mongo.getCurrentUserData,
);
// Return a MongoDB ObjectId
Server.get('/api/v1/get/id', Mongo.getUnusedObjectId);

Server.get('/api/v1/get/users', async (_, response) => {
  const users = await Mongo.getAccountsRepository()
    .collection('users')
    .find({})
    .toArray();
  response.send(
    users.map(user => ({
      username: user.username,
      fullname: user.fullname,
      _id: user._id,
    })),
  );
});

Server.get('/api/v1/get/groups', async (_, response) => {
  const groups = await Mongo.getAccountsRepository()
    .collection('groups')
    .find({})
    .toArray();
  response.send(groups);
});

// POST
// Post single document to collection
// http://localhost:8080/api/v1/post/push/person/
Server.post(
  '/api/v1/post/push/:collection',
  Mongo.validateLoginSession,
  Mongo.addEntityToCollection,
);
// On user submit
Server.post('/api/v1/post/submit', Mongo.validateLoginSession, Mongo.submit);
Server.post(
  '/api/v1/post/submit/:service',
  Mongo.validateLoginSession,
  Mongo.submitService,
);
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
Server.post(
  '/api/v1/post/search/:collection',
  // Mongo.validateLoginSession,
  Mongo.searchByTextFilter,
);
Server.post(
  '/api/v1/post/searchentity/:collection',
  // Mongo.validateLoginSession,
  Mongo.searchByEntityFilter,
);
// Publish or unpublish a entity
const userOwnerHandler = (
  request: Request,
  response: Response,
  next: NextFunction,
) => {
  Mongo.isUserOwnerOfEntity(request, request.body.identifier)
    .then((isOwner): any => {
      if (!isOwner)
        return response.send({
          status: 'error',
          message: 'Not owner of entity',
        });
      next();
    })
    .catch(() =>
      response.send({ status: 'error', message: 'Not owner of entity' }),
    );
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
Server.post(
  ['/login', '/login/*'],
  Express.authenticate({ session: true }),
  Mongo.addToAccounts,
);
// Authentication
Server.post('/register', Express.registerUser);
Server.get('/logout', Mongo.validateLoginSession, Mongo.invalidateSession);

// Admin requests
Server.post(
  '/admin/getldap',
  Express.authenticate(),
  Mongo.updateSessionId,
  Admin.checkIsAdmin,
  Admin.getAllLDAPUsers,
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

// Europeana
// TODO: Auslagern
Server.get('/api/v1/get/europeana/:record/:id', async (request, response) => {
  await Europeana.getRecordData(`${request.params.record}/${request.params.id}`)
    .then((result: any) => {
      try {
        const _relURL = result.data.entity.europeanaAggregation.aggregatedCHO
          .toString()
          .replace('/item/', '');
        const _fullURL = `https://proxy.europeana.eu/${_relURL}`;
        const _fallbackURL = result.data.entity.europeanaAggregation.edmPreview;
        const _type = result.data.entity.type;
        response.send({
          status: 'ok',
          data: result.data.entity,
          fileUrl: _fullURL,
          fallbackUrl: _fallbackURL,
          type: _type,
        });
      } catch (_) {
        response.send({ status: 'error' });
      }
    })
    .catch(e => {
      console.log(e);
      response.send({ status: 'error' });
    });
});

// Mailer
Server.post('/sendmail', Mongo.validateLoginSession, Mailer.sendMail);

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
  '/cleaning/deletenullrefs',
  Express.authenticate(),
  Mongo.updateSessionId,
  Admin.checkIsAdmin,
  Cleaning.deleteNullRefs,
);

Server.post(
  '/cleaning/deleteunused',
  Express.authenticate(),
  Mongo.updateSessionId,
  Admin.checkIsAdmin,
  Cleaning.deleteUnusedPersonsAndInstitutions,
);

// Utility
Server.get(
  '/utility/findentityowners/:identifier',
  Mongo.validateLoginSession,
  Utility.findAllEntityOwnersRequest,
);

Server.get(
  '/utility/countentityuses/:identifier',
  Mongo.validateLoginSession,
  Utility.countEntityUses,
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

Express.startListening();
