import { json as bodyParser } from 'body-parser';
import cors from 'cors';
import { BinaryLike, createHmac, randomBytes } from 'crypto';
import express, { Request, Response } from 'express';
import expressSession from 'express-session';
import connectRedis from 'connect-redis';
import shrinkRay from 'shrink-ray-current';
import { readFileSync } from 'fs';
import { copySync, ensureDirSync, pathExistsSync } from 'fs-extra';
import * as HTTP from 'http';
import * as HTTPS from 'https';
import passport from 'passport';
import LdapStrategy from 'passport-ldapauth';
import LocalStrategy from 'passport-local';
import SocketIo from 'socket.io';
import resTime from 'response-time';

import { RootDirectory } from '../environment';
import { IUserData, EUserRank, ObjectId } from '../common/interfaces';

import { Configuration } from './configuration';
import { SessionCache } from './cache';
import { Logger } from './logger';
import { Mongo } from './mongo';
import { serveFile } from './dynamic-compression';

export interface IPasswordEntry {
  username: string;
  password: {
    salt: BinaryLike;
    passwordHash: string;
  };
}

const {
  enableHTTPS,
  SSLPaths,
  LDAP,
  Port,
  Host,
  PassportSecret,
  OriginWhitelist,
} = Configuration.Express;
const { UploadDirectory } = Configuration.Uploads;

const Server = express();
const createServer = () => {
  if (enableHTTPS) {
    const privateKey = readFileSync(SSLPaths.PrivateKey);
    const certificate = readFileSync(SSLPaths.Certificate);

    const options: HTTPS.ServerOptions = { key: privateKey, cert: certificate };
    if (SSLPaths.Passphrase?.length > 0) {
      options.passphrase = SSLPaths.Passphrase;
    }
    return HTTPS.createServer(options, Server);
  }
  return HTTP.createServer(Server);
};

const Listener = createServer();
const WebSocket = SocketIo(Listener);

const startListening = () => {
  Listener.listen(Port, Host);
  Logger.log(`HTTPS Server started and listening on port ${Port}`);
};

const authenticate = (options: { session: boolean } = { session: false }) =>
  passport.authenticate(['local', 'ldapauth'], { session: options.session });

// Local Auth Registration, Salting and Verification
const generateSalt = (length = 16) => {
  // tslint:disable-next-line
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
};
const sha512 = (password: string, salt: BinaryLike) => {
  const hash = createHmac('sha512', salt);
  hash.update(password);
  const passwordHash = hash.digest('hex');
  return { salt, passwordHash };
};
const SALT_LENGTH = 16;
const saltHashPassword = (password: string) => {
  return sha512(password, generateSalt(SALT_LENGTH));
};

const verifyUser = async (username: string, password: string) => {
  const users = Mongo.getAccountsRepository().collection<IUserData>('users');
  const passwords = Mongo.getAccountsRepository().collection<IPasswordEntry>('passwords');

  // Exit early if user does not exist
  if (!(await users.findOne({ username }))) return false;

  const pwEntry = await passwords.findOne({ username });
  if (!pwEntry) return false;

  const { salt, passwordHash: hash } = pwEntry.password;
  const newHash = sha512(password, salt).passwordHash;
  return newHash === hash;
};

interface IRegisterRequest {
  username: string;
  password: string;
  prename: string;
  surname: string;
  mail: string;
  fullname: string;
}

const registerUser = async (req: Request, res: Response) => {
  const users = Mongo.getAccountsRepository().collection<IUserData>('users');

  const isRegisterRequest = (obj: any): obj is IRegisterRequest => {
    const person = obj as IRegisterRequest;
    return (
      !!person?.fullname &&
      !!person?.prename &&
      !!person?.surname &&
      !!person?.mail &&
      !!person?.username &&
      !!person?.password
    );
  };

  // First user gets admin
  const isFirstUser = (await users.findOne({})) === null;
  const role = isFirstUser ? EUserRank.admin : EUserRank.user;

  const user = req.body as IRegisterRequest;
  if (!isRegisterRequest(user)) return res.status(400).send('Incomplete user data');

  const { username, password } = user;
  if (!!(await users.findOne({ username }))) return res.status(409).send('User already exists');

  const adjustedUser: IUserData & { password?: string } = {
    ...user,
    role,
    data: {},
    _id: new ObjectId(),
    sessionID: '',
    password: undefined,
  };
  delete adjustedUser.password;

  // TODO: Check for errors and simplify
  if (await updateUserPassword(username, password)) {
    return users
      .insertOne(adjustedUser)
      .then(() => res.status(201).send({ status: 'OK', ...adjustedUser }))
      .catch(() => res.status(500).send('Failed inserting user'));
  }
  return res.status(500).send('Failed inserting user');
};

const updateUserPassword = async (username: string, password: string): Promise<boolean> => {
  const passwords = Mongo.getAccountsRepository().collection<IPasswordEntry>('passwords');
  const result = await passwords.updateOne(
    { username },
    { $set: { username, password: saltHashPassword(password) } },
    { upsert: true },
  );
  const success = result.result.ok === 1;
  return success;
};

// ExpressJS Middleware
// Enable CORS
Server.use(
  '*',
  cors({
    origin: (origin, callback) => {
      if (origin && OriginWhitelist.length > 0 && OriginWhitelist.indexOf(origin) === -1) {
        return callback(new Error('Origin not allowed'), false);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    allowedHeaders: [
      'X-Requested-With',
      'Access-Control-Allow-Origin',
      'content-type',
      'semirandomtoken',
      'relPath',
      'metadatakey',
      'prefix',
      'filetype',
    ],
  }),
);
// This turns req.body from application/json reqs into readable JSON
Server.use(bodyParser({ limit: '50mb' }));
// Compression: Brotli -> Fallback GZIP
Server.use(shrinkRay());
// Measure res time of req
Server.use(resTime());
// Static
const upDir = `${RootDirectory}/${UploadDirectory}/`;
Server.use('/uploads', serveFile(upDir));
Server.use('/previews', express.static(`${upDir}/previews`));

// Create preview directory and default preview file
ensureDirSync(`${RootDirectory}/${UploadDirectory}/previews`);
if (!pathExistsSync(`${RootDirectory}/${UploadDirectory}/previews/noimage.png`)) {
  copySync(
    `${RootDirectory}/assets/noimage.png`,
    `${RootDirectory}/${UploadDirectory}/previews/noimage.png`,
  );
}

// Passport
const verifyLdapStrategy: LdapStrategy.VerifyCallback = (user, done) => {
  // This defaults to the LDAP People Schema of the University of Cologne
  const username = user[LDAP?.Keys?.username ?? 'uid'];
  const prename = user[LDAP?.Keys?.prename ?? 'givenName'];
  const surname = user[LDAP?.Keys?.surname ?? 'sn'];
  const mail = user[LDAP?.Keys?.mail ?? 'mail'];

  if (!prename || !surname || !mail || !username) {
    return done('Not all required LDAP fields could be found. Check configuration.');
  }

  const adjustedUser = {
    username,
    fullname: `${prename} ${surname}`,
    prename,
    surname,
    mail,
    role: EUserRank.user,
    data: {},
  };

  return done(undefined, adjustedUser);
};

const verifyLocalStrategy: LocalStrategy.VerifyFunction = async (username, password, done) => {
  const users = Mongo.getAccountsRepository().collection<IUserData>('users');
  const user = await users.findOne({ username });
  if (!user || !(await verifyUser(username, password))) {
    return done(undefined, false);
  }
  return done(undefined, user);
};

const getLDAPConfig: LdapStrategy.OptionsFunction = (req, callback) => {
  if (!LDAP) {
    Logger.warn('LDAP not configured but strategy was called');
    return callback('LDAP not configured but strategy was called', {
      server: {
        searchBase: '',
        searchFilter: '',
        url: '',
      },
    });
  }

  const { username, password } = (req as Request).body;
  callback(undefined, {
    server: {
      url: LDAP?.Host ?? '',
      bindDN: LDAP?.DNauthUID ? `uid=${username},${LDAP?.DN}` : LDAP?.DN ?? '',
      bindCredentials: `${password}`,
      searchBase: LDAP?.searchBase ?? '',
      searchFilter: `(uid=${username})`,
      reconnect: true,
      timeout: 1e4,
    },
  });
};

passport.use(new LdapStrategy(getLDAPConfig, verifyLdapStrategy));
passport.use(new LocalStrategy.Strategy(verifyLocalStrategy));

passport.serializeUser((user: IUserData, done) => done(undefined, user.username));
passport.deserializeUser((username, done) => done(undefined, username));

Server.use(passport.initialize());

// Session
Server.set('trust proxy', 1);
Server.use(
  expressSession({
    store: new (connectRedis(expressSession))({ client: SessionCache.client }),
    secret: PassportSecret,
    resave: false,
    saveUninitialized: false,
    name: 'session',
    cookie: {
      httpOnly: false,
      sameSite: 'none',
      secure: enableHTTPS,
    },
  }),
);
Server.use(passport.session());

const Express = {
  Server,
  passport,
  createServer,
  getLDAPConfig,
  startListening,
  authenticate,
  registerUser,
};

export { Express, Server, WebSocket, updateUserPassword };
