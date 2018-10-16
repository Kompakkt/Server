// Node libraries
const path = require('path')
const fs = require('fs')

// fs-extra for more controlled renaming and moving of files
const fse = require('fs-extra')

// Additional step to generate a unique token-subfolder on upload 
// TODO: Overwrite this with MongoDB _id 
// https://www.mongodb.com/blog/post/generating-globally-unique-identifiers-for-use-with-mongodb
const sha256 = require('sha256')

// Server setup
const express = require('express')
const server = express()


// Body-Parser for easier parsing of RESTful requests
const bodyParser = require('body-parser')

// CORS
const cors = require('cors')

// TODO: Make configuration external
const Configuration = {
    // Directories
	uploads_dir: 'uploads',
	mongo_db_dir: 'data',

    // Upload settings
	useSubfolder: true,
	subfolderPath: 'models',
	port: 8080,
	useToken: true,

    // MongoDB settings
    mongo_port: '5984',
    // mongo_host: 'miskatonic.hki.uni-koeln.de',
    mongo_host: 'localhost',
    mongo_db_name: 'objectsrepository',
    mongo_collections: [
        'Person',
        'Institute',
        'DigitalObject'
    ]
}

// File upload with Multer + Uppie
const multer  = require('multer')
const upload = multer({ dest: Configuration.uploads_dir })

// ExpressJS Middleware
// This turns request.body from application/json requests into readable JSON
server.use(bodyParser.json())
// Enable CORS
// TODO: Find out which routes need CORS
server.use(cors())

// MongoDB setup
const MongoClient = require('mongodb').MongoClient
const ObjectId = require('mongodb').ObjectId
const client = new MongoClient(`mongodb://${Configuration.mongo_host}:${Configuration.mongo_port}/`)

client.connect((error) => {
  if (error) {
    throw error
  }

  const db = client.db(Configuration.mongo_db_name.toLowerCase())

  // Init collections
  Configuration.mongo_collections.forEach(collection => {
    db.createCollection(collection.toLowerCase())
  })
})

// MongoDB REST API
// GET
// Find document by ID in collection
// http://localhost:8080/api/v1/get/find/Person/5bbf023850c06f445ccab442
server.get('/api/v1/get/find/:collection/:identifier', (request, response) => {
    client.connect((error) => {
        if (error) {
            throw error
        }

        console.log(`GET ${request.params.identifier} in ${request.params.collection}`)

        const db = client.db(Configuration.mongo_db_name.toLowerCase())
        const collection = db.collection(request.params.collection.toLowerCase())
        collection.findOne({'_id': new ObjectId(request.params.identifier)},(error, result) => {
            response.send(result)
        })
    })
})
// Return all documents of a collection
server.get('/api/v1/get/findall/:collection', (request,response) => {
    client.connect((error) => {
        if (error) {
            throw error
        }

        const db = client.db(Configuration.mongo_db_name.toLowerCase())
        const collection = db.collection(request.params.collection.toLowerCase())
        collection.find({}).toArray((error, result) => {
            response.send(result)
        })        
    })
})
// POST
// Post single document to collection
// http://localhost:8080/api/v1/post/push/person/
server.post('/api/v1/post/push/:collection', (request, response) => {
    client.connect((error) => {
        if (error) {
            throw error
        }

        console.log(request.params.collection.toLowerCase())
        console.log(request.body)
        
        const db = client.db('objectsrepository')
        const collection = db.collection(request.params.collection.toLowerCase())

        collection.insertOne(request.body, (error,result) => {
            response.send(result.ops)
            console.log(result.ops)
        })
    })
})
// Post multiple documents to collection
server.post('/api/v1/post/pushmultiple/:collection', (request, response) => {
    client.connect((error) => {
        if (error) {
            throw error
        }

        console.log(request.body)
        response.send(request.body)
/*
        const db = client.db('objectsrepository')
        const collection = db.collection(request.params.collection)
*/
        //collection.insertMany(request.body)
    })
})


// END REST API


// SERVE STATIC FILES
server.use(express.static(__dirname + '/dist/ObjectsRepository/models/'))

// UPLOAD API
server.post('/upload', upload.array('files[]'), async (request, response) => {
    console.log('Upload requested!')
    try {
    	let paths = request.body.paths
    	let files = request.files
        let token = sha256(Math.random().toString(36).substring(7))

		files.forEach(file => {
			let originalName = file.originalname
			let newName = file.filename
			let relativeDestination = null
			let oldFullPath = __dirname + '/uploads/' 
			let newFullPath = null

    		paths.forEach(_path => {
    			if (_path.indexOf(originalName) !== -1) {
    				relativeDestination = path.dirname(_path)
    			}
    		})

    		if (relativeDestination != null) {
    			if (Configuration.useSubfolder) {
    				newFullPath = __dirname + '/' + Configuration.subfolderPath
    			}

    			if (Configuration.useToken) {
    				newFullPath += '/' + token
    			}

    			newFullPath += '/' + relativeDestination 

    			if (newFullPath != null) {
    				fse.ensureDirSync(newFullPath)
    			}

    			oldFullPath += newName
    			newFullPath += '/' + originalName

    			fse.moveSync(oldFullPath,newFullPath)
                console.log('File moved to ' + newFullPath)
    		}
    	})
    	response.sendStatus(201)

        //response.send(data.map(x => ({ id: x.$loki, fileName: x.filename, originalName: x.originalname })));
    } catch (err) {
        response.sendStatus(400);
        console.error(err)
    }
})

server.listen(Configuration.port, () => {
	console.info(`Server started and listening on port ${Configuration.port}`)
})
