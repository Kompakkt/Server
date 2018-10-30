import { Configuration } from './services/configuration';
import { Server, Express } from './services/express';
import { Upload } from './services/upload';
import { RootDirectory } from './environment';
import { Mongo } from './services/mongo';

// TODO: Move to upload.ts
// For upload
import { ensureDirSync, moveSync, pathExistsSync, removeSync } from 'fs-extra';
import { dirname } from 'path';
import * as klawSync from 'klaw-sync';
import * as multer from 'multer';

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

const upload = multer({
        dest: `${RootDirectory}/${Configuration.Uploads.TempDirectory}`,
        onFileUploadStart: function(file) {
            console.log(file.originalname + ' is starting ...');
        },
        onFileUploadComplete: function (file) {
            console.log(file.fieldname + ' uploaded to  ' + file.path);
        }
    });

Server.post('/upload', upload.single('file'), (request, response) => {
    const tempPath = `${request['file'].destination}/${request['file'].filename}`;
    let newPath = `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/`;
    if (Configuration.Uploads.createSubfolders) {
        newPath += `${Configuration.Uploads.subfolderPath}/`;
    }
    newPath += `${request.headers['semirandomtoken']}/`;
    newPath += `${request.headers['relpath']}`;

    ensureDirSync(dirname(newPath));
    moveSync(tempPath, newPath);
    response.end('Uploaded');
});

Server.post('/uploadfinished', (request, response) => {
    const Token = request.headers['semirandomtoken'];
    const path = Configuration.Uploads.createSubfolders
    ? `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/${Configuration.Uploads.subfolderPath}/${Token}`
    : `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/${Token}`;

    if (!pathExistsSync(path)) {
        response.status(400).end('Path with this token does not exist');
    } else {
        const foundFiles = klawSync(path);

        // TODO: remove nested top directories until a file is top-level

        response.json(JSON.stringify(foundFiles));
        response.end('Done!');
    }
});

Server.post('/uploadcancel', (request, response) => {
    const Token = request.headers['semirandomtoken'];
    const path = Configuration.Uploads.createSubfolders
    ? `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/${Configuration.Uploads.subfolderPath}/${Token}`
    : `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/${Token}`;

    if (!pathExistsSync(path)) {
        response.status(400).end('Path with this token does not exist');
    } else {
        removeSync(path);
        response.status(200).end('Successfully cancelled upload');
    }
});

Express.startListening();
