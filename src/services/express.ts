import * as bodyParser from 'body-parser';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import * as corser from 'corser';
import * as crypto from 'crypto';
import * as express from 'express';
import * as expressSession from 'express-session';
import { readFileSync } from 'fs';
import { copySync, ensureDirSync, pathExistsSync } from 'fs-extra';
import * as HTTP from 'http';
import * as HTTPS from 'https';
import * as passport from 'passport';
import * as LdapStrategy from 'passport-ldapauth';
import * as LocalStrategy from 'passport-local';
import * as socketIo from 'socket.io';
import * as uuid from 'uuid';
import * as zlib from 'zlib';

import { RootDirectory } from '../environment';
import { ILDAPData } from '../interfaces';
import { Configuration as Conf } from './configuration';
import { Logger } from './logger';
import { Mongo } from './mongo';

const Server = express();
const createServer = () => {
  if (Conf.Express.enableHTTPS) {
    const privateKey = readFileSync(Conf.Express.SSLPaths.PrivateKey);
    const certificate = readFileSync(Conf.Express.SSLPaths.Certificate);

    const options = { key: privateKey, cert: certificate };
    if (Conf.Express.SSLPaths.Passphrase && Conf.Express.SSLPaths.Passphrase.length > 0) {
      options['passphrase'] = Conf.Express.SSLPaths.Passphrase;
    }
    return HTTPS.createServer(options, Server);
  }
  return HTTP.createServer(Server);
};

const getLDAPConfig = (request, callback) => {
  const DN = (Conf.Express.LDAP.DNauthUID)
    ? `uid=${request.body.username},${Conf.Express.LDAP.DN}`
    : Conf.Express.LDAP.DN;
  callback(undefined, {
    server: {
      url: Conf.Express.LDAP.Host,
      bindDN: DN,
      bindCredentials: `${request.body.password}`,
      searchBase: Conf.Express.LDAP.searchBase,
      searchFilter: `(uid=${request.body.username})`,
      reconnect: true,
    },
  });
};

const startListening = () => {
  Listener.listen(Conf.Express.Port, Conf.Express.Host);
  Logger.log(`HTTPS Server started and listening on port ${Conf.Express.Port}`);
};

const authenticate = (options: { session: boolean }
    = { session: false }) => {
    const strat = (Conf.Express.PassportStrategy) ? Conf.Express.PassportStrategy : 'ldapauth';
    return passport.authenticate(strat, { session: options.session });
  };

const Listener = createServer();
const WebSocket = socketIo(Listener);

// ExpressJS Middleware
// This turns request.body from application/json requests into readable JSON
Server.use(bodyParser.json({ limit: '50mb' }));
// Same for cookies
Server.use(cookieParser());
// Gzipping Middleware
Server.use(compression({
  strategy: zlib.Z_FILTERED,
  level: 9,
  memLevel: 9,
  windowBits: 15,
  chunkSize: 65536,
}));
// Enable CORS
// TODO: Find out which routes need CORS
Server.use(corser.create({
  supportsCredentials: true,
  /*origins: Conf.Express.OriginWhitelist,*/
  methods: corser.simpleMethods.concat(['PUT', 'OPTIONS']),
  requestHeaders: corser.simpleRequestHeaders
    .concat([
      'X-Requested-With',
      'Access-Control-Allow-Origin',
      'semirandomtoken',
      'relPath',
      'metadatakey',
      'prefix',
      'filetype']),
}));
// Static
const upDir = `${RootDirectory}/${Conf.Uploads.UploadDirectory}/`;
Server.use('/uploads', express.static(upDir));
Server.use('/previews', express.static(`${upDir}/previews`));

// Create preview directory and default preview file
ensureDirSync(`${RootDirectory}/${Conf.Uploads.UploadDirectory}/previews`);
if (!pathExistsSync(`${RootDirectory}/${Conf.Uploads.UploadDirectory}/previews/noimage.png`)) {
  copySync(
    `${RootDirectory}/assets/noimage.png`,
    `${RootDirectory}/${Conf.Uploads.UploadDirectory}/previews/noimage.png`);
}

// Passport
passport.use(new LdapStrategy(
  getLDAPConfig, (user, done) => {
    const adjustedUser = {
      fullname: user['cn'],
      prename: user['givenName'],
      surname: user['sn'],
      rank: user['UniColognePersonStatus'],
      mail: user['mail'],
      role: user['UniColognePersonStatus'],
    };
    done(undefined, adjustedUser);
  }));

passport.use(new LocalStrategy((username, password, done) => {
  const coll = Mongo
    .getAccountsRepository()
    .collection(Conf.Express.PassportCollection);
  coll.findOne({ username }, async (err, user) => {
    if (err) return done(err);
    if (!user) return done(undefined, false);
    if (!await verifyUser(username, password)) return done(undefined, false);
    return done(undefined, user);
  });
  console.log(username, password);
}));

passport.serializeUser((user: any, done) => {
  const serialValue = Object
    .keys(user)
    .reduce((acc, val) => acc + val + user[val], '');
  done(undefined, serialValue);
});
passport.deserializeUser((id, done) => done(undefined, id));

// Local Auth Registration, Salting and Verification
const generateSalt = (length = 16) => {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
};
const sha512 = (password, salt) => {
  const hash = crypto.createHmac('sha512', salt);
  hash.update(password);
  const passwordHash = hash.digest('hex');
  return { salt, passwordHash };
};
const saltHashPassword = password => {
  return sha512(password, generateSalt(16));
};

const registerUser = async (request, response) => {
  if (Conf.Express.PassportCollection !== 'local') {
    return response
      .send({ status: 'error', message: 'Local authentication not configured' });
  }
  const coll = Mongo
    .getAccountsRepository()
    .collection(Conf.Express.PassportCollection);

  const isUser = (obj: any): obj is ILDAPData => {
    const person = obj as ILDAPData;
    return person && person.fullname !== undefined && person.prename !== undefined
      && person.surname !== undefined && person.mail !== undefined
      && person.username !== undefined && person['password'] !== undefined;
  };

  // First user gets admin
  const isFirstUser = (await coll.findOne({})) === null;
  const rank = (isFirstUser) ? 'A' : 'S';
  const role = rank;

  const user = request.body;
  const adjustedUser = { ...user, role, rank, password: saltHashPassword(user.password) };
  const userExists = (await coll.findOne({ username: user.username })) !== null;
  if (userExists) {
    return response.send({ status: 'error', message: 'User already exists' });
  }
  if (isUser(adjustedUser)) {
    coll.insertOne(adjustedUser)
      .then(() => response.send({ status: 'ok', message: 'Registered' }))
      .catch(() => response.send({ status: 'error', message: 'Failed inserting user' }));
  } else {
    response.send({ status: 'error', message: 'Incomplete user data'});
  }
};

const verifyUser = async (username, password) => {
  const coll = Mongo
    .getAccountsRepository()
    .collection(Conf.Express.PassportCollection);
  const userInDB = await coll.findOne({ username });
  if (!userInDB) return false;
  const salt = userInDB.password.salt;
  const hash = userInDB.password.passwordHash;
  const newHash = sha512(password, salt).passwordHash;
  return newHash === hash;
};

Server.use(passport.initialize());
Server.use(expressSession({
  genid: uuid,
  secret: Conf.Express.PassportSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: false,
    sameSite: false,
  },
}));
Server.use(passport.session());

const Express = {
  Server, passport, createServer, getLDAPConfig, startListening, authenticate, registerUser
};

export { Express, Server, WebSocket };
