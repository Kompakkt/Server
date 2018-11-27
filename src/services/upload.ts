import { Configuration } from './configuration';
import { RootDirectory, Verbose } from '../environment';
import { Server } from './express';

import { ensureDirSync, moveSync, pathExistsSync, removeSync } from 'fs-extra';
import { dirname } from 'path';
import * as klawSync from 'klaw-sync';
import * as multer from 'multer';

const Upload = {
    Multer: multer({
        dest: `${RootDirectory}/${Configuration.Uploads.TempDirectory}`,
        onFileUploadStart: function(file) {
            console.log(file.originalname + ' is starting ...');
        },
        onFileUploadComplete: function(file) {
            console.log(file.fieldname + ' uploaded to  ' + file.path);
        }
    }),
    UploadRequest: (request, response) => {
        // TODO: Checksum
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
    },
    UploadCancel: (request, response) => {
        const Token = request.body.uuid;
        const path = Configuration.Uploads.createSubfolders
            ? `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/${Configuration.Uploads.subfolderPath}/${Token}`
            : `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/${Token}`;

        if (!pathExistsSync(path)) {
            response.status(400).end('Path with this token does not exist');
        } else {
            removeSync(path);
            response.status(200).end('Successfully cancelled upload');
        }
    },
    UploadFinish: async (request, response) => {
        console.log(request.body);
        const Token = request.body.uuid;
        const path = Configuration.Uploads.createSubfolders
            ? `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/${Configuration.Uploads.subfolderPath}/${Token}`
            : `${RootDirectory}/${Configuration.Uploads.UploadDirectory}/${Token}`;

        if (!pathExistsSync(path)) {
            response.status(400).end('Path with this token does not exist');
        } else {
            const foundFiles = klawSync(path);

            const responseFiles = [];

            await foundFiles.map(file => {
                if (file.stats.isFile()) {
                    responseFiles.push(file.path.substr(file.path.indexOf('/models/') + 1));
                }
            });

            // TODO: remove nested top directories until a file is top-level

            response.json(responseFiles);
            response.end('Done!');
        }
    }
};

export { Upload };
