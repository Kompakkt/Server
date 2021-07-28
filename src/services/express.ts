import { json as bodyParser } from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { BinaryLike, createHmac, randomBytes } from 'crypto';
import express from 'express';
import expressSession from 'express-session';
import shrinkRay from 'shrink-ray-current';
import { readFileSync } from 'fs';
import { copySync, ensureDirSync, pathExistsSync } from 'fs-extra';
import * as HTTP from 'http';
import * as HTTPS from 'https';
import passport from 'passport';
import LdapStrategy from 'passport-ldapauth';
import { Strategy as LocalStrategy } from 'passport-local';
import SocketIo from 'socket.io';
import resTime from 'response-time';

import { RootDirectory } from '../environment';
import { IUserData, EUserRank } from '../common/interfaces';

import { Configuration } from './configuration';
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

    const options = { key: privateKey, cert: certificate };
    if (SSLPaths.Passphrase && SSLPaths.Passphrase.length > 0) {
      (options as any)['passphrase'] = SSLPaths.Passphrase;
    }
    return HTTPS.createServer(options, Server);
  }
  return HTTP.createServer(Server);
};

const getLDAPConfig: LdapStrategy.OptionsFunction = (_req, callback) => {
  if (!LDAP) {
    Logger.warn('LDAP not configured but strategy was called');
    callback('LDAP not configured', {
      server: {
        url: '',
        searchBase: '',
        searchFilter: '',
      },
    });
  } else {
    const req = _req as express.Request;
    const DN = LDAP.DNauthUID ? `uid=${req.body.username},${LDAP.DN}` : LDAP.DN;
    callback(undefined, {
      server: {
        url: LDAP.Host,
        bindDN: DN,
        bindCredentials: `${req.body.password}`,
        searchBase: LDAP.searchBase,
        searchFilter: `(uid=${req.body.username})`,
        reconnect: true,
      },
    });
  }
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
  const coll = Mongo.getAccountsRepository().collection('users');
  const passwords = Mongo.getAccountsRepository().collection('passwords');
  const userInDB = await coll.findOne({ username });
  if (!userInDB) return false;
  const pwOfUser = await passwords.findOne({ username });
  if (!pwOfUser) return false;
  const salt = pwOfUser.password.salt;
  const hash = pwOfUser.password.passwordHash;
  const newHash = sha512(password, salt).passwordHash;
  return newHash === hash;
};

interface IRegisterRequest extends IUserData {
  password: string;
}

const registerUser = async (req: express.Request, res: express.Response): Promise<any> => {
  const coll = Mongo.getAccountsRepository().collection('users');

  const isUser = (obj: any): obj is IRegisterRequest => {
    const person = obj as IRegisterRequest;
    return (
      person &&
      person.fullname !== undefined &&
      person.prename !== undefined &&
      person.surname !== undefined &&
      person.mail !== undefined &&
      person.username !== undefined &&
      person.password !== undefined
    );
  };

  // First user gets admin
  const isFirstUser = (await coll.findOne({})) === null;
  const role = isFirstUser ? EUserRank.admin : EUserRank.user;

  const user = req.body as IUserData & { password: string };
  const adjustedUser = { ...user, role, data: {} };
  const userExists = (await coll.findOne({ username: user.username })) !== null;
  if (userExists) return res.status(409).send('User already exists');
  if (isUser(adjustedUser)) {
    // cast as any to delete non-optional property password
    // we don't want the password to be written to the database in clear text
    delete (adjustedUser as any).password;
    const success = await updateUserPassword(user.username, user.password);
    if (success) {
      coll
        .insertOne(adjustedUser)
        .then(() => res.status(201).send('Registered'))
        .catch(() => res.status(500).send('Failed inserting user'));
    } else {
      res.status(500).send('Failed inserting user');
    }
  } else {
    res.status(400).send('Incomplete user data');
  }
};

const updateUserPassword = async (username: string, password: string): Promise<boolean> => {
  const passwords = Mongo.getAccountsRepository().collection<IPasswordEntry>('passwords');
  const result = await passwords.updateOne(
    { username: username },
    {
      $set: {
        username: username,
        password: saltHashPassword(password),
      },
    },
    { upsert: true },
  );
  const success = result.result.ok === 1;
  return success;
};

const UUID_LENGTH = 64;
const genid = () => randomBytes(UUID_LENGTH).toString('hex');

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
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE'.split(','),
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
// Same for cookies
Server.use(cookieParser());
// Compression: Brotli -> Fallback GZIP
Server.use(shrinkRay());
// Measure res time of req
Server.use(resTime());
// Static
const upDir = `${RootDirectory}/${UploadDirectory}/`;
//Server.use('/uploads', express.static(upDir));
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

interface LDAPUserResponse {
  dn: string;
  controls: any[];
  objectClass: string[];
  schacGender: string;
  givenName: string;
  uid: string;
  mail: string;
  sn: string;
  description: string;
  userPassword: string;
  UniColognePersonStatus: string;
}

// Passport
passport.use(
  new LdapStrategy(
    getLDAPConfig,
    (user: LDAPUserResponse, done: any): LdapStrategy.VerifyCallback => {
      const { givenName: prename, sn: surname, mail } = user;
      const adjustedUser = {
        fullname: `${user['givenName']} ${user['sn']}`,
        prename,
        surname,
        mail,
        role: EUserRank.user,
      };
      return done(undefined, adjustedUser);
    },
  ),
);

passport.use(
  new LocalStrategy((username: string, password: string, done: any) => {
    const coll = Mongo.getAccountsRepository().collection('users');
    coll.findOne({ username }, async (err, user) => {
      if (err) {
        return done(err);
      }
      if (!user || !(await verifyUser(username, password))) {
        return done(undefined, false);
      }
      return done(undefined, user);
    });
  }),
);

passport.serializeUser((user: any, done) => {
  const serialValue = Object.keys(user)
    .reduce((acc, val) => `${acc}${val}${user[val]}`, '')
    .replace(/[.]*[_]*[-]*/g, '');
  done(undefined, serialValue);
});
passport.deserializeUser((id, done) => done(undefined, id));

Server.use(passport.initialize());

Server.set('trust proxy', 1);
Server.use(
  expressSession({
    genid,
    secret: PassportSecret,
    resave: false,
    saveUninitialized: false,
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
