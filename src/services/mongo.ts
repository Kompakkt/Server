/**
 * Imported external configuration
 * MongoClient is the main way to connect to a MongoDB server
 * ObjectId is the type & constructor of a MongoDB unique identifier
 */
import { MongoClient, ObjectId } from 'mongodb';
import { Configuration } from './configuration';

/**
 * Imported for detailed logging
 */
import { Verbose } from '../environment';
import { inspect as InspectObject } from 'util';

/**
 * Object containing variables which define an established connection
 * to a MongoDB Server specified in Configuration
 * @type {Object}
 */
const Mongo = {
    Client: undefined,
    Connection: undefined,
    DBObjectsRepository: undefined,
    Retry: 0,
    MaxRetries: 10,
    ReconnectInterval: undefined,
    /**
     * Initialize a MongoDB Client
     * uses hostname and port defined in Configuration file
     */
    initClient: () => {
        this.Client = new MongoClient(`mongodb://${Configuration.Mongo.Hostname}:${Configuration.Mongo.Port}/`, { useNewUrlParser: true });
    },
    /**
     * Make sure our predefined collections exist in the Database
     */
    initCollections: () => {
        this.Connection.then(() => {
            Configuration.Mongo.Databases.ObjectsRepository.Collections.forEach(collection => {
                this.DBObjectsRepository.createCollection(collection.toLowerCase());
            });
        });
    },
    /**
     * Establish connection to the server
     * Saving this as a variable allows re-using the same connection
     * This reduces latency on all calls
     * TODO: If the connection closes, re-open it
     */
    establishConnection: () => {
        this.Connection = this.Client.connect();
    },
    initReconnect: () => {
        this.Connection.then(() => {
            this.DBObjectsRepository.on('close', () => {
                console.log('Connection closed. Retrying...');
                setTimeout(() => {
                    Mongo.Connection = undefined;
                    Mongo.ReconnectInterval = setInterval(() => {
                        if (Mongo.Connection === undefined) {
                            Mongo.Retry++;
                            if (Mongo.Retry <= Mongo.MaxRetries) {
                                Mongo.establishConnection();
                            } else {
                                console.log(`Reconnect failed after ${Mongo.MaxRetries} tries`);
                                Mongo.ReconnectInterval = undefined;
                                Mongo.Retry = 0;
                            }
                        } else {
                            console.log('Reconnected!');
                            Mongo.ReconnectInterval = undefined;
                            Mongo.Retry = 0;
                        }
                    }, 1000);
                }, 1000);
            });
        });
    },
    /**
     * Save the most used Database as a variable
     * to reduce the amount of calls needed
     */
    initObjectsRepository: () => {
        this.Connection.then(() => {
            this.DBObjectsRepository = this.Client.db(Configuration.Mongo.Databases.ObjectsRepository.Name);
        });
    },
    /**
     * When the user submits the metadataform this function
     * adds the missing data to defined collections
     */
    submit: (request, response) => {
        this.Connection.then(async () => {
            if (Verbose) {
                console.log('VERBOSE: Handling submit request');
                console.log(InspectObject(request.body));
            }

            const resultObject = request.body;

            /**
             * Adds data {field} to a collection {collection}
             * and returns the {_id} of the created object.
             * If {field} already has an {_id} property the server
             * will assume the object already exists in the collection
             * and instead return the existing {_id}
             */
            const addAndGetId = async (field, collection) => {
                    return (field['_id'] !== undefined && field['_id'].length > 0) ?
                         String(field['_id']) :
                         await this.DBObjectsRepository.collection(collection).insertOne(field).then(result => {
                            return String(result.ops[0]['_id']);
                        });
                    };

            /**
             * Use addAndGetId function on all Arrays containing
             * data that need to be added to collections
             */

            // TODO: Eleganter lösen
            resultObject['contact_person'] = await Promise.all(
                resultObject['contact_person'].map(async person => addAndGetId(person, 'person')));

            resultObject['digobj_rightsowner_person'] = await Promise.all(
                resultObject['digobj_rightsowner_person'].map(async person => addAndGetId(person, 'person')));

            resultObject['digobj_person'] = await Promise.all(
                resultObject['digobj_person'].map(async person => addAndGetId(person, 'person')));

            resultObject['digobj_rightsowner_institution'] = await Promise.all(
                resultObject['digobj_rightsowner_institution'].map(async institution => addAndGetId(institution, 'institution')));

            /*
            resultObject['digobj_tags'] = await Promise.all(
                resultObject['digobj_tags'].map(async tag => addAndGetId(tag, 'tag')));
            */


            if (Verbose) {
                console.log('VERBOSE: Finished Object');
                console.log(InspectObject(resultObject));
            }

            response.send(resultObject);
        });
    },
    /**
     * Express HTTP POST request
     * Handles a single document that needs to be added
     * to our Database
     * request.body is any JavaScript Object
     * On success, sends a response containing the added Object
     */
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
    /**
     * Express HTTP POST request
     * Handles multiple documents that need to be added
     * to our Database
     * request.body is any Array of JavaScript Objects
     * On success, sends a response containing the added Array
     */
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
    /**
     * TODO: Handle user accounts
     */
    addToAccounts: (collection, data) => {

    },
    /**
     * Express HTTP GET request
     * Finds any document in any collection by its MongoDB identifier
     * On success, sends a response containing the Object
     * TODO: Handle No Objects found?
     */
    getFromObjectCollection: (request, response) => {
        this.Connection.then(() => {
            const collection = this.DBObjectsRepository.collection(request.params.collection.toLowerCase());

            collection.findOne({ '_id': new ObjectId(request.params.identifier) }, (db_error, result) => {
                response.send(result);
            });
        });
    },
    /**
     * Express HTTP GET request
     * Finds all documents in any collection
     * On success, sends a response containing an Array
     * of all Objects in the specified collection
     * TODO: Handle No Objects found?
     */
    getAllFromObjectCollection: (request, response) => {
        this.Connection.then(() => {
            const collection = this.DBObjectsRepository.collection(request.params.collection.toLowerCase());

            collection.find({}).toArray((db_error, result) => {
                response.send(result);
            });
        });
    }
};

const ReconnectProxy = new Proxy(Mongo, {
    get (target, property, receiver) {
        console.log(target);
        console.log(property);
        console.log(receiver);
        return target[property];
    }
});

/**
 * Initialization
 */
Mongo.initClient();
Mongo.establishConnection();
Mongo.initObjectsRepository();
Mongo.initCollections();
Mongo.initReconnect();

export { Mongo };
