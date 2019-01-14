import { readJsonSync } from 'fs-extra';
import { Verbose, RootDirectory, ConfigFile } from '../environment';
import { inspect as InspectObject } from 'util';
import { isMaster } from 'cluster';

const LoadConfig = () => {
    const DefaultConfiguration = {
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
                        'compilation'
                    ]
                },
                Accounts: {
                    Name: 'accounts',
                    Collections: [
                        'ldap'
                    ]
                }
            },
            Port: 27017,
            Hostname: 'localhost'
        },
        Uploads: {
            TempDirectory: 'temp',
            UploadDirectory: 'uploads',
            createSubfolders: true,
            subfolderPath: 'models'
        },
        Express: {
            Port: 8080,
            OriginWhitelist: [
                'http://localhost:4200',
                'http://localhost:8080',
                'http://localhost:8080/upload',
                'http://localhost:8080/uploadfinished'
            ],
            enableHTTPS: false,
            SSLPaths: {
                PrivateKey: '',
                Certificate: ''
            },
            PassportSecret: 'change me',
            LDAP: {
              DN: 'cn=admin,dc=example,dc=org',
              DNauthUID: true,
              Host: 'ldap://localhost',
              searchBase: 'dc=example,dc=org'
            },
            InsecureAdminAccounts: [
              {username: 'localadmin', password: 'changeme'}
            ]
        }
    };

    if (Verbose) { console.log('INFO: Loading configuration'); }

    try {
        if (Verbose && isMaster) {
            console.log(`INFO: Config file path: ${ConfigFile}`);
        }

        const confObj = readJsonSync(`${ConfigFile}`);

        if (Verbose && isMaster) {
            console.log('INFO: Configuration details: ');
            console.log(InspectObject(confObj, { showHidden: false, depth: null }));
        }

        return confObj;

    } catch (error) {
        if (isMaster) {
          if (error.code === 'ENOENT') {
              console.log('Config file not found. Falling back to default configuration');
          } else {
              console.log('Failed loading configuration file. Falling back to default configuration');
          }
        }
        return DefaultConfiguration;
    }
};

const Configuration = LoadConfig();

export { Configuration };
