# ObjectsRepositoryServer

## What is this?

This is the backend Express server to complete the MEAN stack with our ObjectsRepository and our MongoDB instance

## Configuration

For an example configuration you can take a look at the fallback configuration that will be used if no ```config.json``` file is found next to the ```server.js```

The first level of configuration objects is split into the bigger modules used
```
{
	"Mongo": {...},
	"Express": {...},
	"Uploads": {...}
}
```

### Mongo Configuration

The Mongo configuration object can take a Port variable for the Server to know how to connect to a Mongo instance, aswell as the hostname of a Mongo instance.
Apart from those it can take a Database object, which contains any number of Objects consisting of a Name variable and an array of Collection names.
```
// TODO: Turn Databases into Array instead, then save them by name variable into a Database Object in the Mongo service
"Port": 1234,
"Hostname": "mymongohost.io",
"Databases": {
	"ExampleDatabase": {
		"Name": "databaseName",
		"Collections": [
			"collection1",
			"myCollection",
			"pictures"
		]
	},
	"ExampleDB2": {
		...
	}
}
```

### Uploads configuration

The Uploads object of the configuration controls where temporary uploads are stored and additional configuration on where they will be moved

```
"Uploads": {
	// Specifies temporary upload location before the upload will be moved
	"UploadDirectory": "tempUploads",
	// If this is disabled files will simply be put into the root path of the server.js runtime location
	"createSubfolders": true,
	// Specifies the directory where the files will be moved after processing
	"subfolderPath": "finalUploads",
	// Enable if you want the files to be put into a unique folder inside of the final location
	"useToken": true
}
```

### Express configuration

The Express configuration only takes the Port at the moment
```
"Express": {
	"Port": 2345
}
```
