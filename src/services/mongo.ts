import { MongoClient, ObjectId } from 'mongodb';
import { Configuration } from './configuration';
import { Verbose } from '../environment';
import { inspect as InspectObject } from 'util';

const Mongo = {
    Client: undefined,
    Connection: undefined,
    DBObjectsRepository: undefined,
    initClient: () => {
        this.Client = new MongoClient(`mongodb://${Configuration.Mongo.Hostname}:${Configuration.Mongo.Port}/`, { useNewUrlParser: true });
    },
    initCollections: () => {
        this.Connection.then(() => {
            const db = this.Client.db(Configuration.Mongo.Databases.ObjectsRepository.Name.toLowerCase());

            Configuration.Mongo.Databases.ObjectsRepository.Collections.forEach(collection => {
                db.createCollection(collection.toLowerCase());
            });
        });
    },
    establishConnection: () => {
        this.Connection = this.Client.connect();
    },
    initObjectsRepository: () => {
        this.Connection.then(() => {
            this.DBObjectsRepository = this.Client.db(Configuration.Mongo.Databases.ObjectsRepository.Name);
        });
    },
    addToObjectCollection: (request, response) => {
        this.Connection.then(() => {
            if (Verbose) {
                console.log('VERBOSE: Adding the following document to collection ' + request.params.collection);
                console.log(request.params.collection.toLowerCase());
                console.log(InspectObject(request.body));
            }

            const collection = this.DBObjectsRepository.collection(request.params.collection.toLowerCase());

            collection.insertOne(request.body, (db_error, result) => {
                response.send(result.ops);

                if (Verbose) {
                    console.log('VERBOSE: Success! Added the following');
                    console.log(result.ops);
                }
            });
        });
    },
    addMultipleToObjectCollection: (request, response) => {
        this.Connection.then(() => {
            if (Verbose) {
                console.log('VERBOSE: Adding the following document to collection ' + request.params.collection);
                console.log(request.params.collection.toLowerCase());
                console.log(InspectObject(request.body));
            }

            const collection = this.DBObjectsRepository.collection(request.params.collection.toLowerCase());

            collection.insertMany(request.body, (db_error, result) => {
                response.send(result.ops);
                if (Verbose) {
                    console.log('VERBOSE: Success! Added the following');
                    console.log(result.ops);
                }
            });
        });
    },
    addToAccounts: (collection, data) => {

    },
    getFromObjectCollection: (request, response) => {
        this.Connection.then(() => {
            const collection = this.DBObjectsRepository.collection(request.params.collection.toLowerCase());

            collection.findOne({ '_id': new ObjectId(request.params.identifier) }, (db_error, result) => {
                response.send(result);
            });
        });
    },
    getAllFromObjectCollection: (request, response) => {
        this.Connection.then(() => {
            const collection = this.DBObjectsRepository.collection(request.params.collection.toLowerCase());
            
            collection.find({}).toArray((db_error, result) => {
                response.send(result);
            });
        });
    }
};

Mongo.initClient();
Mongo.establishConnection();
Mongo.initCollections();
Mongo.initObjectsRepository();

export { Mongo };
