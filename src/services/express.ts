import * as express from 'express';
import { RootDirectory } from '../environment';
import { Configuration } from './configuration';
import * as bodyParser from 'body-parser';
import * as corser from 'corser';

const Express = {
    server: express(),
    startListening: () => {
        Server.listen(Configuration.Express.Port, () => {
            console.log(`Server started and listening on port ${Configuration.Express.Port}`);
        });
    }
};

const Server = Express.server;

// ExpressJS Middleware
// This turns request.body from application/json requests into readable JSON
Server.use(bodyParser.json());
// Enable CORS
// TODO: Find out which routes need CORS
Server.use(corser.create());
// Static
if (Configuration.Uploads.createSubfolders) {
    Server.use('/models', express.static(`${RootDirectory}/${Configuration.Uploads.UploadDirectory}/${Configuration.Uploads.subfolderPath}`));
} else  {
    Server.use('/models', express.static(`${RootDirectory}/${Configuration.Uploads.UploadDirectory}`));
}

export { Express, Server };
