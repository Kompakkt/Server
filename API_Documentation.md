# Authentication

Some API routes are locked behind your Kompakkt account and need authentication details.
Authentication happens using a session cookie, so any HTTP Client with a cookie jar or similar way to keep track of cookies will work.

To get a session cookie you can use the login route.

# Login

This route is used to get your session cookie and receive your user data

## POST
```$host/login```

Request example:
```json
{
  "username": "...",
  "password": "..."
}
```

Response example:
```json
{
  "status": "ok",
  "fullname": "Max Mustermann",
  "prename": "Max",
  "surname": "Mustermann",
  "mail": "max@mustermail.de",
  "role": "uploader",
  "username": "mmustermann",
  "sessionID": "785cd99a9724d93de9c0df95210680c90f974742489c88efdec9262747a43773e1aee061752a43dafb976ee631ea73741bcafc8f6f4d7a9ad9ad755eeecfc290",
  "data": {
    "annotation": [
      // ...
    ],
    "entity": [
      // ...
    ],
    "person": [
      // ...
    ],
    "institution": [
      // ...
    ],
    "digitalentity": [
      // ...
    ],
    "compilation": [
      // ...
    ],
    "tag": [
      // ...
    ]
  }
}
```

# Userdata

Your userdata can always be retrieved without having to login again

## GET

```$host/auth```
or
```$host/api/v1/get/ldata```

Response example:
```json
{
  "status": "ok",
  "fullname": "Max Mustermann",
  "prename": "Max",
  "surname": "Mustermann",
  "mail": "max@mustermail.de",
  "role": "uploader",
  "username": "mmustermann",
  "sessionID": "785cd99a9724d93de9c0df95210680c90f974742489c88efdec9262747a43773e1aee061752a43dafb976ee631ea73741bcafc8f6f4d7a9ad9ad755eeecfc290",
  "data": {
    "annotation": [
      // ...
    ],
    "entity": [
      // ...
    ],
    "person": [
      // ...
    ],
    "institution": [
      // ...
    ],
    "digitalentity": [
      // ...
    ],
    "compilation": [
      // ...
    ],
    "tag": [
      // ...
    ]
  }
}
```

# Retrieve a single document via identifier in a document collection

With the identifier of a document (any public database entry) you can retrieve the document with all its content

## GET
```/api/v1/get/find/:collection/:identifier```
or
```/api/v1/get/find/:collection/:identifier/:password```

Types of collections:
|Visible name|Database name|Note|
|------------|-------------|----|
|Object|entity||
|Collection|compilation|Password protected collection should be fetched via the second route|
|Person|person|These are not Kompakkt users, but persons in metadata|
|Institution|institution||
|Tag|tag||
|Annotation|annotation||
|Digital Metadata|digitalentity||
|Physical Metadata|physicalentity||
|Group|group||

# Retrieve all documents in a document collection

You can get all public database entries

## GET
```/api/v1/get/findall/:collection```

Types of collections:
|Visible name|Database name|Note|
|------------|-------------|----|
|Object|entity||
|Collection|compilation|Password protected collection should be fetched via the second route|
|Person|person|These are not Kompakkt users, but persons in metadata|
|Institution|institution||
|Tag|tag||
|Annotation|annotation||
|Digital Metadata|digitalentity||
|Physical Metadata|physicalentity||
|Group|group||

# Retrieve all usernames & fullnames

## Locked route

## GET
```/api/v1/get/users```

Response example:
```json
[
  {
    "username": "mmustermann",
    "fullname": "Max Mustermann",
    "_id": "..."
  }, {
    "username": "mmusterfrau",
    "fullname": "Marie Musterfrau",
    "_id": "..."
  },
  // ...
]
```

# Find all object owners

## Locked route

## GET
```/utility/findentityowners/:identifier```

Response example:
```json
{
  "status": "ok",
  "accounts": [
    {
      "username": "mmustermann",
      "fullname": "Max Mustermann",
      "_id": "..."
    }, {
      "username": "mmusterfrau",
      "fullname": "Marie Musterfrau",
      "_id": "..."
    }
  ]
}
```

# Count how often an object is used

## Locked route

## GET
```/utility/countentityuses/:identifier```

Response example:
```json
{
  "status": "ok",
  "occurences": 1,
  "compilations": [
    {
      "_id": "5d6f790772b3dc766b27d752",
      "annotationList": [
        // ...
      ],
      "description": "For cat lovers",
      "entities": [
        { "_id": "..." },
        { "_id": "..." },
        // ...
      ],
      "name": "Nice cats",
      "password": "",
      "relatedOwner": {
        "username": "mmustermann",
        "fullname": "Max Mustermann",
        "_id": "..."
      },
      "whitelist": {
        "enabled": false,
        "persons": [],
        "groups": []
      }
    }
  ]
}
```
