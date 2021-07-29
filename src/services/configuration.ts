import { isMaster } from 'cluster';
import deepmerge from 'deepmerge';
import { readJsonSync } from 'fs-extra';

import { ConfigFile } from '../environment';

import { Logger } from './logger';

interface IConfiguration {
  Mongo: {
    RepositoryDB: string;
    AccountsDB: string;
    Port: number;
    Hostname: string;
    ClientURL?: string;
  };
  Redis: {
    Hostname: string;
    Port: number;
    DBOffset: number;
  };
  Uploads: {
    TempDirectory: string;
    UploadDirectory: string;
  };
  Express: {
    Host: string;
    PublicIP: string;
    Port: number;
    OriginWhitelist: string[];
    enableHTTPS: boolean;
    SSLPaths: {
      PrivateKey: string;
      Certificate: string;
      Passphrase: string;
    };
    PassportSecret: string;
    LDAP?: {
      DN: string;
      DNauthUID: boolean;
      Host: string;
      searchBase: string;
    };
  };
  Services?: {
    Europeana?: {
      apiKey: string;
      endpoint: string;
    };
  };
  Mailer: {
    Host?: string;
    Port?: number;
    Target?: {
      contact: string;
      upload: string;
      bugreport: string;
    };
  };
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
      PublicIP: 'localhost',
      Port: 8080,
      OriginWhitelist: [],
      enableHTTPS: false,
      SSLPaths: {
        PrivateKey: '',
        Certificate: '',
        Passphrase: '',
      },
      PassportSecret: 'change me',
    },
    Mailer: {},
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
  } catch (error) {
    if (isMaster) {
      if (error.code === 'ENOENT') {
        Logger.err('Config file not found. Falling back to default configuration');
      } else {
        Logger.err('Failed loading configuration file. Falling back to default configuration');
        Logger.err(error);
      }
      Logger.log('Configuration loaded from defaults');
    }
    return DefaultConfiguration;
  }
};

const Configuration = LoadConfig();

export { Configuration };
