import { MongoClient, ObjectId } from 'mongodb';
import { Configuration } from './configuration';

const Mongo = {
    Client: undefined,
    Connection: undefined,
    initClient: () => {
        this.Client = new MongoClient(`mongodb://${Configuration.Mongo.Hostname}:${Configuration.Mongo.Port}/`, { useNewUrlParser: true });
    },
    initCollections: () => {
        this.Connection.then(() => {
            const db = this.Client.db(Configuration.Mongo.Databases.ObjectsRepository.Name.toLowerCase());

            // Init collections
            Configuration.Mongo.Databases.ObjectsRepository.Collections.forEach(collection => {
                db.createCollection(collection.toLowerCase());
            });
        });
    },
    establishConnection: () => {
        this.Connection = this.Client.connect();
    },
    addToObjectCollection: (request, response) => {
        this.Connection.then(() => {
            console.log(request.params.collection.toLowerCase());
            console.log(request.body);

            const db = this.Client.db('objectsrepository');
            const collection = db.collection(request.params.collection.toLowerCase());

            collection.insertOne(request.body, (db_error, result) => {
                response.send(result.ops);
                console.log(result.ops);
            });
        });
    },
    addMultipleToObjectCollection: (request, response) => {
        this.Connection.then(() => {
            console.log(request.body);
            response.send(request.body);

            const db = this.Client.db('objectsrepository')
            const collection = db.collection(request.params.collection)

            // collection.insertMany(request.body)
        });
    },
    addToAccounts: (collection, data) => {

    },
    getFromObjectCollection: (request, response) => {
        this.Connection.then(() => {
            const db = this.Client.db(Configuration.Mongo.Databases.ObjectsRepository.Name.toLowerCase());
            const _collection = db.collection(request.params.collection.toLowerCase());
            _collection.findOne({ '_id': new ObjectId(request.params.identifier) }, (db_error, result) => {
                response.send(result);
            });
        });
    },
    getAllFromObjectCollection: (request, response) => {
        this.Connection.then(() => {
            const db = this.Client.db(Configuration.Mongo.Databases.ObjectsRepository.Name.toLowerCase());
            const collection = db.collection(request.params.collection.toLowerCase());
            collection.find({}).toArray((db_error, result) => {
                response.send(result);
            });
        });
    }
};

Mongo.initClient();
Mongo.establishConnection();
Mongo.initCollections();

export { Mongo };
