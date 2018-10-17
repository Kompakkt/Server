import { Configuration } from './services/configuration';
import { Upload } from './services/upload';
import { RootDirectory } from './environment';

// Node libraries
const path = require('path');
const fs = require('fs');

// fs-extra for more controlled renaming and moving of files
const fse = require('fs-extra');

// Additional step to generate a unique token-subfolder on upload
// TODO: Overwrite this with MongoDB _id
// https://www.mongodb.com/blog/post/generating-globally-unique-identifiers-for-use-with-mongodb
const sha256 = require('sha256');

// Server setup
const express = require('express');
const server = express();


// Body-Parser for easier parsing of RESTful requests
const bodyParser = require('body-parser');

// CORS
const cors = require('cors');

// TODO: Make configuration external


// File upload with Multer + Uppie
const multer  = require('multer');
const upload = multer({ dest: `${RootDirectory}/${Configuration.Uploads.UploadDirectory}` });

// ExpressJS Middleware
// This turns request.body from application/json requests into readable JSON
server.use(bodyParser.json());
// Enable CORS
// TODO: Find out which routes need CORS
server.use(cors());

// MongoDB setup
const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectId;
const client = new MongoClient(`mongodb://${Configuration.Mongo.Hostname}:${Configuration.Mongo.Port}/`, { useNewUrlParser: true } );

client.connect((error) => {
  if (error) {
    throw error;
  }

  const db = client.db(Configuration.Mongo.Databases.ObjectsRepository.Name.toLowerCase());

  // Init collections
  Configuration.Mongo.Databases.ObjectsRepository.Collections.forEach(collection => {
    db.createCollection(collection.toLowerCase());
  });
});

// MongoDB REST API
// GET
// Find document by ID in collection
// http://localhost:8080/api/v1/get/find/Person/5bbf023850c06f445ccab442
server.get('/api/v1/get/find/:collection/:identifier', (request, response) => {
    client.connect((error) => {
        if (error) {
            throw error;
        }

        console.log(`GET ${request.params.identifier} in ${request.params.collection}`);

        const db = client.db(Configuration.Mongo.Databases.ObjectsRepository.Name.toLowerCase());
        const collection = db.collection(request.params.collection.toLowerCase());
        collection.findOne({'_id': new ObjectId(request.params.identifier)}, ( db_error, result) => {
            response.send(result);
        });
    });
});
// Return all documents of a collection
server.get('/api/v1/get/findall/:collection', (request, response) => {
    client.connect((error) => {
        if (error) {
            throw error;
        }

        const db = client.db(Configuration.Mongo.Databases.ObjectsRepository.Name.toLowerCase());
        const collection = db.collection(request.params.collection.toLowerCase());
        collection.find({}).toArray(( db_error, result) => {
            response.send(result);
        });
    });
});
// POST
// Post single document to collection
// http://localhost:8080/api/v1/post/push/person/
server.post('/api/v1/post/push/:collection', (request, response) => {
    client.connect((error) => {
        if (error) {
            throw error;
        }

        console.log(request.params.collection.toLowerCase());
        console.log(request.body);

        const db = client.db('objectsrepository');
        const collection = db.collection(request.params.collection.toLowerCase());

        collection.insertOne(request.body, ( db_error, result) => {
            response.send(result.ops);
            console.log(result.ops);
        });
    });
});
// Post multiple documents to collection
server.post('/api/v1/post/pushmultiple/:collection', (request, response) => {
    client.connect((error) => {
        if (error) {
            throw error;
        }

        console.log(request.body);
        response.send(request.body);
/*
        const db = client.db('objectsrepository')
        const collection = db.collection(request.params.collection)
*/
        // collection.insertMany(request.body)
    });
});


// END REST API


// SERVE STATIC FILES
server.use(express.static(__dirname + '/dist/ObjectsRepository/models/'));

// UPLOAD API
server.post('/upload', upload.array('files[]'), (request, response) => {
    Upload.handle(request, response);
});

server.listen(Configuration.Express.Port, () => {
    console.log(`Server started and listening on port ${Configuration.Express.Port}`);
});
