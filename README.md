# Kompakkt Server

<p align="center">
    <img src="https://github.com/Kompakkt/Assets/raw/main/server-logo.png" alt="Kompakkt Logo" width="600">
</p>

## Prerequisites

- [NodeJS](https://nodejs.org/en/)
- Node Package Manager ([NPM](https://www.npmjs.com/))
- MongoDB
- Redis

## Development setup

In order to setup your own development environment, you have to have [NodeJS](https://nodejs.org/en/) as well as Node Package Manager ([NPM](https://www.npmjs.com/)) installed.

Clone this repository, cd to the project directory and run the following commands:

```
$ git clone https://github.com/Kompakkt/Common.git src/common
$ npm i
```

Ensure that MongoDB and Redis is running then start the server with

```
$ npm run start
```

## Running tests

Tests are located in the `src/tests`-directory and can be ran using `npm run test`.

For easier testing, a docker-compose setup is included, which can be ran using `docker-compose -f docker-compose.test.yml up`.
