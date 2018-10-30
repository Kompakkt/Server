import * as express from 'express';
import { RootDirectory } from '../environment';
import { Configuration } from './configuration';
import * as bodyParser from 'body-parser';
import * as cors from 'cors';

const Express = {
    server: express(),
    startListening: () => {
        Server.listen(Configuration.Express.Port, () => {
            console.log(`Server started and listening on port ${Configuration.Express.Port}`);
        });
    }
};

const Server = Express.server;

Server.use(express.static(RootDirectory + Configuration.Uploads.subfolderPath));
// ExpressJS Middleware
// This turns request.body from application/json requests into readable JSON
Server.use(bodyParser.json());
// Enable CORS
// TODO: Find out which routes need CORS
Server.use(cors({
    origin: (origin, callback) => {
        callback(null, true);
        /*
        if (Configuration.Express.OriginWhitelist.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
        */
    },
    credentials: true
}));

export { Express, Server };
