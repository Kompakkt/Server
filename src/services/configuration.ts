import { isMaster } from 'cluster';
import * as merge from 'deepmerge';
import { readJsonSync } from 'fs-extra';

import { ConfigFile } from '../environment';

import { Logger } from './logger';

interface IConfiguration {
  Mongo: {
    RepositoryDB: string;
    AccountsDB: string;
    Port: number;
    Hostname: string;
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
      RepositoryDB: 'objectsrepository',
      AccountsDB: 'accounts',
      Port: 27017,
      Hostname: 'localhost',
    },
    Uploads: {
      TempDirectory: 'temp',
      UploadDirectory: 'uploads',
    },
    Express: {
      Host: '127.0.0.1',
      PublicIP: 'localhost',
      Port: 8080,
      OriginWhitelist: [
        'http://localhost:4200',
        'http://localhost:8080',
        'http://localhost:8080/upload',
        'http://localhost:8080/uploadfinished',
      ],
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

    const confObj = merge<IConfiguration>(DefaultConfiguration, readJsonSync(`${ConfigFile}`));

    if (confObj.Uploads.TempDirectory.includes('../') ||
    confObj.Uploads.UploadDirectory.includes('../')) {
      throw new Error('Upload path contains ../, but traversing up is not supported');
    }

    Logger.info('Configuration details: ');
    Logger.info(confObj);

    return confObj;

  } catch (error) {
    if (isMaster) {
      Logger.err(error);
      if (error.code === 'ENOENT') {
        Logger.err('Config file not found. Falling back to default configuration');
      } else {
        Logger.err('Failed loading configuration file. Falling back to default configuration');
      }
      Logger.log(DefaultConfiguration);
    }
    return DefaultConfiguration;
  }
};

const Configuration = LoadConfig();

export { Configuration };
