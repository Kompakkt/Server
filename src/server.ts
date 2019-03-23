import { Europeana } from './services/europeana';
import { Express, Server, WebSocket } from './services/express';
import { Mongo } from './services/mongo';
import { Socket } from './services/socket';
import { Upload } from './services/upload';

// Check if MongoDB is connected
Server.use(Mongo.isMongoDBConnected);
Server.use(Mongo.fixObjectId);

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

// WebSocket
WebSocket.on('connection', Socket._handler);

Express.startListening();
