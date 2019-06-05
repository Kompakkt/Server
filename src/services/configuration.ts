import { isMaster } from 'cluster';
import * as merge from 'deepmerge';
import { readJsonSync } from 'fs-extra';

import { ConfigFile } from '../environment';

import { Logger } from './logger';

const LoadConfig = () => {
  // TODO: Configuration Interface
  const DefaultConfiguration: any = {
    Mongo: {
      Databases: {
        ObjectsRepository: {
          Name: 'objectsrepository',
          Collections: [
            'person',
            'institution',
            'digitalobject',
            'annotation',
            'tag',
            'physicalobject',
            'model',
            'compilation',
          ],
        },
        Accounts: {
          Name: 'accounts',
          Collections: [
            'ldap',
          ],
        },
      },
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
      PassportStrategy: 'ldapauth',
      LDAP: {
        DN: 'cn=admin,dc=example,dc=org',
        DNauthUID: true,
        Host: 'ldap://localhost',
        searchBase: 'dc=example,dc=org',
      },
      InsecureAdminAccounts: [],
    },
    Mailer: {},
  };

  Logger.info('Loading configuration');

  try {
    Logger.info(`Config file path: ${ConfigFile}`);

    const confObj = merge<any>(DefaultConfiguration, readJsonSync(`${ConfigFile}`));

    Logger.info('Configuration details: ');
    Logger.info(confObj);

    return confObj;

  } catch (error) {
    if (isMaster) {
      if (error.code === 'ENOENT') {
        Logger.err('Config file not found. Falling back to default configuration');
      } else {
        Logger.err('Failed loading configuration file. Falling back to default configuration');
      }
    }
    return DefaultConfiguration;
  }
};

const Configuration = LoadConfig();

export { Configuration };
