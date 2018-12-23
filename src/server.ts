import { isMaster, fork } from 'cluster';
import { cpus } from 'os';
import { Configuration } from './services/configuration';
import { Server, Express } from './services/express';
import { Upload } from './services/upload';
import { RootDirectory } from './environment';
import { Mongo } from './services/mongo';

if (isMaster) {
    const CPUs = cpus().length;
    console.log(`Forking for ${CPUs} CPUs`);
    for (let i = 0; i < CPUs * 2; i++) {
        fork();
    }
} else {
    // MongoDB REST API
    // GET
    // Find document by ID in collection
    // http://localhost:8080/api/v1/get/find/Person/5bbf023850c06f445ccab442
    Server.get('/api/v1/get/find/:collection/:identifier', Mongo.getFromObjectCollection);
    // Return all documents of a collection
    Server.get('/api/v1/get/findall/:collection', Mongo.getAllFromObjectCollection);
    // POST
    // Post single document to collection
    // http://localhost:8080/api/v1/post/push/person/
    Server.post('/api/v1/post/push/:collection', Mongo.addToObjectCollection);
    // Post multiple documents to collection
    Server.post('/api/v1/post/pushmultiple/:collection', Mongo.addMultipleToObjectCollection);
    // On user submit
    Server.post('/api/v1/post/submit', Mongo.submit);
    // On Screenshot update
    Server.post('/api/v1/post/screenshot/:identifier', Mongo.updateScreenshot);

    // Upload API
    // Upload a file to the server
    Server.post('/upload', Upload.Multer.single('file'), Upload.UploadRequest);
    // User signals that all necessary files are uploaded
    // TODO: Post Upload Cleanup
    Server.post('/uploadfinished', Upload.UploadFinish);
    // User signals that upload was cancelled
    Server.post('/uploadcancel', Upload.UploadCancel);
    // Metadata
    Server.post('/addmetadata', Upload.Multer.single('file'), Upload.AddMetadata);
    Server.post('/cancelmetadata', Upload.Multer.single('file'), Upload.CancelMetadata);

    Express.startListening();

}
