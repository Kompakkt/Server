import { json as bodyParser } from 'body-parser';
import cors from 'cors';
import { BinaryLike, createHmac, randomBytes } from 'crypto';
import express, { Request, Response } from 'express';
import expressSession from 'express-session';
import connectRedis from 'connect-redis';
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
import { IUserData, UserRank, ObjectId } from '../common';
import { Accounts, getEmptyUserData } from './db';
import { Configuration } from './configuration';
import { SessionCache } from './cache';
import { Logger } from './logger';
import { serveFile } from './dynamic-compression';

export interface IPasswordEntry {
  username: string;
  password: {
    salt: BinaryLike;
    passwordHash: string;
  };
}

const { enableHTTPS, SSLPaths, LDAP, Port, Host, PassportSecret, OriginWhitelist } =
  Configuration.Express;
const { UploadDirectory } = Configuration.Uploads;

const Server = express();
const createServer = () => {
  if (enableHTTPS && SSLPaths) {
    const privateKey = readFileSync(SSLPaths.PrivateKey);
    const certificate = readFileSync(SSLPaths.Certificate);

    const options: HTTPS.ServerOptions = { key: privateKey, cert: certificate };
    if (!!SSLPaths.Passphrase) {
      options.passphrase = SSLPaths.Passphrase;
    }
    return HTTPS.createServer(options, Server);
  }
  return HTTP.createServer(Server);
};

const Listener = createServer();
const WebSocket = new SocketIo.Server(Listener);

const startListening = () => {
  Listener.listen(Port, Host);
  Logger.log(`HTTPS Server started and listening on port ${Port}`);
};

const AUTH_METHODS = !!LDAP ? ['local', 'ldapauth'] : ['local'];
const authenticate = (options: { session: boolean } = { session: false }) =>
  passport.authenticate(AUTH_METHODS, {
    session: options.session,
  });

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

const verifyPassword = async (username: string, password: string) => {
  // Exit early if user does not exist
  if (!(await Accounts.users.findOne({ username }))) return false;

  const pwEntry = await Accounts.passwords.findOne({ username });
  if (!pwEntry) return false;

  const { salt, passwordHash: hash } = pwEntry.password;
  const newHash = sha512(password, salt).passwordHash;
  return newHash === hash;
};

export interface ILoginBody {
  username: string;
  password: string;
}

export const isLoginRequest = (obj: any): obj is ILoginBody => {
  const person = obj as Partial<ILoginBody>;
  return person?.username !== undefined && person?.password !== undefined;
};

export interface IRegisterBody extends ILoginBody {
  prename: string;
  surname: string;
  mail: string;
  fullname: string;
}

export const isRegisterRequest = (obj: any): obj is IRegisterBody => {
  const person = obj as Partial<IRegisterBody>;
  return (
    person?.fullname !== undefined &&
    person?.prename !== undefined &&
    person?.surname !== undefined &&
    person?.mail !== undefined &&
    isLoginRequest(person)
  );
};

const registerUser = async (req: Request<any, any, IRegisterBody>, res: Response) => {
  // First user gets admin
  const isFirstUser = (await Accounts.users.findOne({})) === undefined;
  const role = isFirstUser ? UserRank.admin : UserRank.user;

  if (!isRegisterRequest(req.body)) return res.status(400).send('Incomplete user data');

  const user = req.body;
  const { username, password } = user;
  if (!!(await Accounts.users.findOne({ username })))
    return res.status(409).send('User already exists');

  const adjustedUser: IUserData & { password?: string } = {
    ...user,
    role,
    data: getEmptyUserData(),
    _id: new ObjectId(),
    sessionID: '',
    password: undefined,
  };
  delete adjustedUser.password;

  if (
    (await updateUserPassword(username, password)) &&
    !!(await Accounts.users.insertOne(adjustedUser))
  ) {
    return res.status(201).send({ status: 'OK', ...adjustedUser });
  }
  return res.status(500).send('Failed inserting user');
};

const updateUserPassword = async (username: string, password: string): Promise<boolean> => {
  const result = await Accounts.passwords.updateOne(
    { username },
    { $set: { username, password: saltHashPassword(password) } },
    { upsert: true },
  );
  return !!result;
};

// ExpressJS Middleware
// Enable CORS
Server.use(
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
    Logger.warn('Missing fields from LDAP response or incorrect configuration');
    return done(undefined, false);
  }

  const adjustedUser: Omit<Omit<IUserData, 'sessionID'>, '_id'> & { strategy: string } = {
    username,
    fullname: `${prename} ${surname}`,
    prename,
    surname,
    mail,
    role: UserRank.user,
    data: getEmptyUserData(),
    strategy: 'ldap',
  };

  Logger.log(`${adjustedUser.fullname} logging in using LDAP strategy`);

  return done(undefined, adjustedUser);
};

const verifyLocalStrategy: LocalStrategy.VerifyFunction = async (username, password, done) => {
  const user = await Accounts.users.findOne({ username });
  if (!user || !(await verifyPassword(username, password))) {
    return done(undefined, false);
  }

  Logger.log(`${user.fullname} logging in using local strategy`);

  return done(undefined, { ...user, strategy: 'local' });
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

  const { username, password } = (req as Request<any, any, ILoginBody>).body;
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

passport.serializeUser((user, done) => done(undefined, (user as IUserData).username));
passport.deserializeUser((username, done) => done(undefined, username as string));

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
      secure: true,
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
