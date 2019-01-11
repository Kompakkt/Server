import * as express from 'express';
import { worker } from 'cluster';
import { RootDirectory } from '../environment';
import { Configuration as Conf } from './configuration';
import * as bodyParser from 'body-parser';
import * as corser from 'corser';
import * as compression from 'compression';
import * as zlib from 'zlib';

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
            if (worker.id === 1) {
              console.log(`HTTPS Server started and listening on port ${Conf.Express.Port}`);
            }
        } else {
            HTTP.createServer(Server).listen(Conf.Express.Port);
            if (worker.id === 1) {
              console.log(`HTTP Server started and listening on port ${Conf.Express.Port}`);
            }
        }
    }
};

const Server = Express.server;

// ExpressJS Middleware
// This turns request.body from application/json requests into readable JSON
Server.use(bodyParser.json({limit: '50mb'}));
// Gzipping Middleware
Server.use(compression({
    strategy: zlib.Z_FILTERED,
    level: 9,
    memLevel: 9,
    windowBits: 15,
    chunkSize: 65536
}));
// Enable CORS
// TODO: Find out which routes need CORS
Server.use(corser.create({
    supportsCredentials: true,
    /*origins: Conf.Express.OriginWhitelist,*/
    methods: corser.simpleMethods.concat(['PUT', 'OPTIONS']),
    requestHeaders: corser.simpleRequestHeaders.concat(['X-Requested-With', 'Access-Control-Allow-Origin', 'semirandomtoken', 'relPath', 'metadatakey', 'prefix'])
}));
// Static
if (Conf.Uploads.createSubfolders) {
    Server.use('/models', express.static(`${RootDirectory}/${Conf.Uploads.UploadDirectory}/${Conf.Uploads.subfolderPath}`));
} else  {
    Server.use('/models', express.static(`${RootDirectory}/${Conf.Uploads.UploadDirectory}`));
}

export { Express, Server };
