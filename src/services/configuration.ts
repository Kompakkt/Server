import { readJsonSync } from 'fs-extra';
import { Verbose, RootDirectory, ConfigFile } from '../environment';
import { inspect as InspectObject } from 'util';

const LoadConfig = () => {
    const DefaultConfiguration = {
        Mongo: {
            Databases: {
                ObjectsRepository: {
                    Name: 'objectsrepository',
                    Collections: [
                        'person',
                        'institute',
                        'digitalobject',
                        'annotation'
                    ]
                },
                Accounts: {
                    Name: 'accounts',
                    Collections: [
                        'ldap'
                    ]
                }
            },
            Port: 5984,
            Hostname: 'localhost'
        },
        Uploads: {
            UploadDirectory: 'uploads',
            createSubfolders: true,
            subfolderPath: 'models',
            useToken: true
        },
        Express: {
            Port: 8080
        }
    };

    if (Verbose) { console.log('INFO: Loading configuration'); }

    try {
        if (Verbose) {
            console.log(`INFO: Config file path: ${ConfigFile}`);
        }

        const confObj = readJsonSync(`${ConfigFile}`);

        if (Verbose) {
            console.log('INFO: Configuration details: ');
            console.log(InspectObject(confObj, { showHidden: false, depth: null }));
        }

        return confObj;

    } catch (error) {
        console.error(error);
        console.log('Failed loading configuration file. Falling back to default configuration');
        return DefaultConfiguration;
    }
};

const Configuration = LoadConfig();

export { Configuration };
