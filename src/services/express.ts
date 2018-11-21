import * as express from 'express';
import { RootDirectory } from '../environment';
import { Configuration as Conf } from './configuration';
import * as bodyParser from 'body-parser';
import * as corser from 'corser';

import { readFileSync } from 'fs';
import * as HTTP from 'http';
import * as HTTPS from 'https';

const Express = {
    server: express(),
    startListening: () => {
        if (Conf.Express.enableHTTPS) {
            const privateKey = readFileSync(Conf.Express.SSLPaths.PrivateKey);
            const certificate = readFileSync(Conf.Express.SSLPaths.Certificate);

            HTTPS.createServer({key: privateKey, cert: certificate}, Server).listen(Conf.Express.Port);
            console.log(`HTTPS Server started and listening on port ${Conf.Express.Port}`);
        } else {
            HTTP.createServer(Server).listen(Conf.Express.Port);
            console.log(`HTTP Server started and listening on port ${Conf.Express.Port}`);
        }

        /*Server.listen(Conf.Express.Port, () => {
            console.log(`Server started and listening on port ${Conf.Express.Port}`);
        });*/
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
if (Conf.Uploads.createSubfolders) {
    Server.use('/models', express.static(`${RootDirectory}/${Conf.Uploads.UploadDirectory}/${Conf.Uploads.subfolderPath}`));
} else  {
    Server.use('/models', express.static(`${RootDirectory}/${Conf.Uploads.UploadDirectory}`));
}

export { Express, Server };
