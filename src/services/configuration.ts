import deepmerge from 'deepmerge';
import { readJsonSync } from 'fs-extra';
import { ConfigFile } from '../environment';
import { Logger } from './logger';

export interface IMongoConfiguration {
  RepositoryDB: string;
  AccountsDB: string;
  Port: number;
  Hostname: string;
  ClientURL?: string;
}

export interface IRedisConfiguration {
  Hostname: string;
  Port: number;
  DBOffset: number;
}

export interface IUploadConfiguration {
  TempDirectory: string;
  UploadDirectory: string;
}

export interface IExpressConfiguration {
  Host: string;
  Port: number;
  OriginWhitelist: string[];
  PassportSecret: string;
  enableHTTPS: boolean;
  SSLPaths?: IExpressSSLConfiguration;
  LDAP?: ILDAPConfiguration;
}

export interface IExpressSSLConfiguration {
  PrivateKey: string;
  Certificate: string;
  Passphrase?: string;
}

export interface ILDAPKeys {
  username: string;
  prename: string;
  surname: string;
  mail: string;
}

export interface ILDAPConfiguration {
  DN: string;
  DNauthUID: boolean;
  Host: string;
  searchBase: string;
  Keys?: ILDAPKeys;
}

export const isLDAPConfiguration = (obj: any): obj is ILDAPConfiguration => {
  return (
    !!obj &&
    obj?.DN !== undefined &&
    obj?.DNauthID !== undefined &&
    obj?.Host !== undefined &&
    obj?.searchBase !== undefined
  );
};

export interface IMailerConfiguration {
  Host: string;
  Port: number;
  Target: {
    contact: string;
    upload: string;
    bugreport: string;
  };
}

export const isMailConfiguration = (obj: any): obj is IMailerConfiguration => {
  return (
    !!obj &&
    obj?.Host !== undefined &&
    obj?.Port !== undefined &&
    obj?.Target !== undefined &&
    obj?.Target.contact !== undefined &&
    obj?.Target.upload !== undefined &&
    obj?.Target.bugreport !== undefined
  );
};

interface IConfiguration {
  Mongo: IMongoConfiguration;
  Redis: IRedisConfiguration;
  Uploads: IUploadConfiguration;
  Express: IExpressConfiguration;
  Services?: {
    Europeana?: {
      apiKey: string;
      endpoint: string;
    };
  };
  Mailer?: IMailerConfiguration;
}

const LoadConfig = () => {
  const DefaultConfiguration: IConfiguration = {
    Mongo: {
      RepositoryDB: 'entitiesrepository',
      AccountsDB: 'accounts',
      Port: 27017,
      Hostname: 'localhost',
    },
    Redis: {
      Hostname: 'localhost',
      Port: 6379,
      DBOffset: 1,
    },
    Uploads: {
      TempDirectory: 'temp',
      UploadDirectory: 'uploads',
    },
    Express: {
      Host: '127.0.0.1',
      Port: 8080,
      OriginWhitelist: [],
      enableHTTPS: false,
      PassportSecret: 'change me',
    },
  };

  Logger.info('Loading configuration');

  try {
    Logger.info(`Config file path: ${ConfigFile}`);

    const confObj = deepmerge<IConfiguration>(DefaultConfiguration, readJsonSync(`${ConfigFile}`));

    if (
      confObj.Uploads.TempDirectory.includes('../') ||
      confObj.Uploads.UploadDirectory.includes('../')
    ) {
      throw new Error('Upload path contains ../, but traversing up is not supported');
    }

    Logger.info('Configuration loaded from file');

    return confObj;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      Logger.err('Config file not found. Falling back to default configuration');
    } else {
      Logger.err('Failed loading configuration file. Falling back to default configuration');
      Logger.err(error);
    }
    Logger.log('Configuration loaded from defaults');
    return DefaultConfiguration;
  }
};

const Configuration = LoadConfig();

export { Configuration };
