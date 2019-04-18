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
  Mongo.validateLoginSession,
  Mongo.getObjectFromCollection,
);
// Return all documents of a collection
Server.get(
  '/api/v1/get/findall/:collection',
  Mongo.validateLoginSession,
  Mongo.getAllObjectsFromCollection,
);
// Return data linked to currently logged in LDAP Account
Server.get('/api/v1/get/ldata', Mongo.validateLoginSession, Mongo.getCurrentUserData);
// Return a MongoDB ObjectId
Server.get('/api/v1/get/id', Mongo.getUnusedObjectId);

// POST
// Post single document to collection
// http://localhost:8080/api/v1/post/push/person/
Server.post(
  '/api/v1/post/push/:collection',
  Mongo.validateLoginSession,
  Mongo.addObjectToCollection,
);
// On user submit
Server.post(
  '/api/v1/post/submit',
  Mongo.validateLoginSession,
  Mongo.submit,
);
Server.post(
  '/api/v1/post/submit/:service',
  Mongo.validateLoginSession,
  Mongo.submitService,
);
// On Screenshot update
Server.post(
  '/api/v1/post/settings/:identifier',
  Mongo.validateLoginSession,
  Mongo.updateModelSettings,
);
// Remove document from collection
Server.post(
  '/api/v1/post/remove/:collection/:identifier',
  Express.passport.authenticate('ldapauth', { session: false }),
  Mongo.validateLoginSession,
  Mongo.removeObjectFromCollection,
);
// Return search data
Server.post(
  '/api/v1/post/search/:collection',
  Mongo.validateLoginSession,
  Mongo.searchObjectWithFilter,
);
// Publish or unpublish a model
Server.post(
  '/api/v1/post/publish',
  Mongo.validateLoginSession,
  (request, response, next) => Mongo.isUserOwnerOfObject(request, request.body.identifier)
    .then(isOwner => {
      if (!isOwner) return response.send({ status: 'error', message: 'Not owner of model' });
      next();
    })
    .catch(() => response.send({ status: 'error', message: 'Not owner of model' })),
  Admin.toggleObjectPublishedState);

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
Server.post(
  '/uploadfinished',
  Mongo.validateLoginSession,
  Upload.UploadFinish,
);
// User signals that upload was cancelled
Server.post(
  '/uploadcancel',
  Mongo.validateLoginSession,
  Upload.UploadCancel,
);
// Metadata
Server.post(
  '/addmetadata', Mongo.validateLoginSession,
  Upload.Multer.single('file'), Upload.AddMetadata,
);
Server.post(
  '/cancelmetadata', Mongo.validateLoginSession,
  Upload.Multer.single('file'), Upload.CancelMetadata,
);

// Authentication
Server.post(
  '/login',
  Express.passport.authenticate('ldapauth', { session: true }),
  Mongo.addToAccounts,
);
Server.get('/auth', Mongo.validateLoginSession, (_, res) => res.send({ status: 'ok' }));
Server.get('/logout', Mongo.validateLoginSession, Mongo.invalidateSession);

// Admin requests
Server.post(
  '/admin/getldap',
  Express.passport.authenticate('ldapauth', { session: false }),
  Admin.checkIsAdmin,
  Admin.getAllLDAPUsers);

Server.post(
  '/admin/promoteuser',
  Express.passport.authenticate('ldapauth', { session: false }),
  Admin.checkIsAdmin,
  Admin.promoteUserToRole);

Server.post(
  '/admin/togglepublished',
  Express.passport.authenticate('ldapauth', { session: false }),
  Admin.checkIsAdmin,
  Admin.toggleObjectPublishedState);

// Europeana
// TODO: Auslagern
Server.get('/api/v1/get/europeana/:record/:id', async (request, response) => {
  await Europeana.getRecordData(`${request.params.record}/${request.params.id}`)
    .then((result: any) => {
      try {
        const _relURL = result.data.object.europeanaAggregation.aggregatedCHO
          .toString()
          .replace('/item/', '');
        const _fullURL = `https://proxy.europeana.eu/${_relURL}`;
        const _fallbackURL = result.data.object.europeanaAggregation.edmPreview;
        const _type = result.data.object.type;
        response.send(
          {
            status: 'ok',
            data: result.data.object,
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

// WebSocket
WebSocket.on('connection', Socket._handler);

// Cleaning
Server.post(
  '/cleaning/deletenullrefs',
  Express.passport.authenticate('ldapauth', { session: false }),
  Admin.checkIsAdmin,
  Cleaning.deleteNullRefs);

Server.post(
  '/cleaning/deleteunused',
  Express.passport.authenticate('ldapauth', { session: false }),
  Admin.checkIsAdmin,
  Cleaning.deleteUnusedPersonsAndInstitutions);

// Utility
Server.get(
  '/utility/findmodelowners/:identifier',
  Mongo.validateLoginSession,
  Utility.findAllModelOwners);

Server.get(
  '/utility/countmodeluses/:identifier',
  Mongo.validateLoginSession,
  Utility.countModelUses);

Server.post(
  '/utility/moveannotations/:identifier',
  Mongo.validateLoginSession,
  Utility.addAnnotationsToAnnotationList);

Express.startListening();
