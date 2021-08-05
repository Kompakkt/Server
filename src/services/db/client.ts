import { MongoClient, ObjectId } from 'mongodb';
import { Request, Response, NextFunction } from 'express';

import { Configuration } from '../configuration';
import { Logger } from '../logger';

const { ClientURL, Hostname, Port } = Configuration.Mongo;
const MongoURL = ClientURL ?? `mongodb://${Hostname}:${Port}/`;

class DBClient {
  public static Client = new MongoClient(MongoURL);
  public static isConnected = false;

  public Middleware = {
    /**
     * Checks whether we are connected to the MongoDB server
     * @type {Request}
     */
    isConnected: (_: Request, res: Response, next: NextFunction) => {
      if (!this.isConnected) {
        Logger.warn('Incoming req while not connected to MongoDB');
        return res.status(500).send('Cannot connect to Database. Contact sysadmin');
      }
      return next();
    },
    /**
     * Make any sent _id in the body an actual ObjectId
     * @type {[type]}
     */
    fixObjectId: (
      req: Request<any, any, { _id?: string | ObjectId }>,
      _: Response,
      next: NextFunction,
    ) => {
      const { _id } = req?.body;
      if (_id && ObjectId.isValid(_id)) req.body._id = new ObjectId(_id);
      next();
    },
  };

  constructor() {
    if (!this.isConnected) this.connect();
  }

  get Client() {
    return DBClient.Client;
  }

  get isConnected() {
    return DBClient.isConnected;
  }

  private connect() {
    this.Client.connect(error => {
      if (!error) {
        DBClient.isConnected = true;
        Logger.info('Connected to MongoDB');
      } else {
        Logger.err(`Couldn't connect to MongoDB.
          Make sure it is running and check your configuration`);
        process.exit(1);
      }
    });
  }

  public getUnusedObjectId(_: Request, res: Response) {
    return res.status(200).send(new ObjectId());
  }
}

export default new DBClient();

const db = (name: string) => DBClient.Client.db(name);

export { db };
