import { isMaster, fork } from 'cluster';
import { cpus } from 'os';
import { Configuration } from './services/configuration';
import { Server, Express } from './services/express';
import { Upload } from './services/upload';
import { RootDirectory } from './environment';
import { Mongo } from './services/mongo';

if (isMaster) {
  const CPUs = cpus().length;
  const threads = ((CPUs >= 4) ? CPUs / 2 : 4);
  console.log(`Creating ${threads} threads`);
  for (let i = 0; i < threads; i++) {
    fork();
  }
} else {
  // Check if MongoDB is connected
  Server.use(Mongo.isMongoDBConnected);
  Server.use(Mongo.fixObjectId);

  // MongoDB REST API
  // GET
  // Find document by ID in collection
  // http://localhost:8080/api/v1/get/find/Person/5bbf023850c06f445ccab442
  Server.get('/api/v1/get/find/:collection/:identifier', Mongo.checkAccount, Mongo.getFromObjectCollection);
  // Return all documents of a collection
  Server.get('/api/v1/get/findall/:collection', Mongo.checkAccount, Mongo.getAllFromObjectCollection);
  // Return data linked to currently logged in LDAP Account
  Server.get('/api/v1/get/ldata', Mongo.checkAccount, Mongo.getLinkedData);

  // POST
  // Post single document to collection
  // http://localhost:8080/api/v1/post/push/person/
  Server.post('/api/v1/post/push/:collection', Mongo.checkAccount, Mongo.addToObjectCollection);
  // On user submit
  Server.post('/api/v1/post/submit', Mongo.checkAccount, Mongo.submit);
  // On Screenshot update
  Server.post('/api/v1/post/settings/:identifier', Mongo.checkAccount, Mongo.updateSettings);
  // Remove document from collection
  Server.post('/api/v1/post/remove/:collection/:identifier',
    Express.passport.authenticate('ldapauth', { session: false }),
    Mongo.checkAccount,
    Mongo.removeObjectFromObjectCollection);
  // Return search data
  Server.post('/api/v1/post/search/:collection', Mongo.checkAccount, Mongo.searchObjectWithFilter);

  // Upload API
  // Upload a file to the server
  Server.post('/upload', Mongo.checkAccount, Upload.Multer.single('file'), Upload.UploadRequest);
  // User signals that all necessary files are uploaded
  // TODO: Post Upload Cleanup
  Server.post('/uploadfinished', Mongo.checkAccount, Upload.UploadFinish);
  // User signals that upload was cancelled
  Server.post('/uploadcancel', Mongo.checkAccount, Upload.UploadCancel);
  // Metadata
  Server.post('/addmetadata', Mongo.checkAccount, Upload.Multer.single('file'), Upload.AddMetadata);
  Server.post('/cancelmetadata', Mongo.checkAccount, Upload.Multer.single('file'), Upload.CancelMetadata);

  // Authentication
  Server.post('/login', Express.passport.authenticate('ldapauth', { session: true }), Mongo.addToAccounts);
  Server.get('/auth', Mongo.checkAccount, (req, res) => res.send({ status: 'ok' }));

  Express.startListening();

}
