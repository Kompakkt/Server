import { Configuration } from './configuration';
import { dirname } from 'path';
import { ensureDirSync, moveSync } from 'fs-extra';
import { RootDirectory, Verbose } from '../environment';
import { Server } from './express';

import * as multer from 'multer';

// Additional step to generate a unique token-subfolder on upload
// TODO: Overwrite this with MongoDB _id
// https://www.mongodb.com/blog/post/generating-globally-unique-identifiers-for-use-with-mongodb

import * as sha256 from 'sha256';

const Upload = {
    Multer: multer({ dest: `${RootDirectory}/${Configuration.Uploads.UploadDirectory}` }),
    handle: (request, response) => {
        if (Verbose) {
            console.log('INFO: Upload Request received');
        }
        try {
            const paths = request.body.paths;
            const files = request.files;
            const token = sha256(Math.random().toString(36).substring(7));

            files.forEach(file => {
                const originalName = file.originalname;
                const newName = file.filename;
                let relativeDestination = null;
                let oldFullPath = RootDirectory + '/uploads/';
                let newFullPath = null;

                paths.forEach(_path => {
                    if (_path.indexOf(originalName) !== -1) {
                        relativeDestination = dirname(_path);
                    }
                });

                if (relativeDestination != null) {
                    if (Configuration.Uploads.createSubfolders) {
                        newFullPath = RootDirectory + '/' + Configuration.Uploads.subfolderPath;
                    }

                    if (Configuration.Uploads.useToken) {
                        newFullPath += '/' + token;
                    }

                    newFullPath += '/' + relativeDestination;

                    if (newFullPath != null) {
                        ensureDirSync(newFullPath);
                    }

                    oldFullPath += newName;
                    newFullPath += '/' + originalName;

                    moveSync(oldFullPath, newFullPath);
                    console.log('File moved to ' + newFullPath);
                }
            });
            response.sendStatus(201);

            if (Verbose) {
                console.log('INFO: Upload succeeded');
            }
            // response.send(data.map(x => ({ id: x.$loki, fileName: x.filename, originalName: x.originalname })));
        } catch (err) {
            response.sendStatus(400);
            console.error(err);
        }
    }
};

Server.post('/upload', Upload.Multer.array('files[]'), (request, response) => {
    Upload.handle(request, response);
});

console.log(Upload.Multer);

export { Upload };
