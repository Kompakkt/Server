import deepmerge from 'deepmerge';
import { ConfigFile } from './environment';
import { err, info, log } from './logger';
import { CommandLineArguments } from './arguments';
import { capitalize } from './util/string-helpers';

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
  Auth: {
    User: string;
    Pass: string;
  };
  Secure: boolean;
}

export const isMailConfiguration = (obj: any, checkAuth?: boolean): obj is IMailerConfiguration => {
  return (
    !!obj &&
    obj?.Host !== undefined &&
    obj?.Port !== undefined &&
    obj?.Target !== undefined &&
    obj?.Target.contact !== undefined &&
    obj?.Target.upload !== undefined &&
    obj?.Target.bugreport !== undefined &&
    // check for auth
    (checkAuth
      ? obj?.Auth !== undefined && obj?.Auth.User !== undefined && obj?.Auth.Pass !== undefined
      : true)
  );
};

interface IKompressorConfiguration {
  Enabled: boolean;
  Hostname: string;
  Port: number;
}

export interface IConfiguration<T = Record<string, Record<string, string>>> {
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
  Kompressor: IKompressorConfiguration;
  Mailer?: IMailerConfiguration;
  Extensions?: T;
}

const LoadConfig = async () => {
  const environmentVariables = new Array<string>();

  const getEnv = (key: string): string | undefined => {
    const value = Bun.env[key];
    environmentVariables.push(key);
    if (!value) {
      return undefined;
    }
    log(`Environment variable ${key} found`);
    return value;
  };

  const DefaultConfiguration: IConfiguration = {
    Mongo: {
      RepositoryDB: getEnv('CONFIGURATION_MONGO_REPOSITORY_DB') || 'entitiesrepository',
      AccountsDB: getEnv('CONFIGURATION_MONGO_ACCOUNTS_DB') || 'accounts',
      Port: parseInt(getEnv('CONFIGURATION_MONGO_PORT') || '27017', 10),
      Hostname: getEnv('CONFIGURATION_MONGO_HOSTNAME') || 'localhost',
    },
    Redis: {
      Hostname: getEnv('CONFIGURATION_REDIS_HOSTNAME') || 'localhost',
      Port: parseInt(getEnv('CONFIGURATION_REDIS_PORT') || '6379', 10),
      DBOffset: parseInt(getEnv('CONFIGURATION_REDIS_DB_OFFSET') || '1', 10),
    },
    Uploads: {
      TempDirectory: getEnv('CONFIGURATION_UPLOADS_TEMP_DIRECTORY') || 'temp',
      UploadDirectory: getEnv('CONFIGURATION_UPLOADS_UPLOAD_DIRECTORY') || 'uploads',
    },
    Express: {
      Host: getEnv('CONFIGURATION_EXPRESS_HOST') || '127.0.0.1',
      Port: parseInt(getEnv('CONFIGURATION_EXPRESS_PORT') || '8080', 10),
      OriginWhitelist: (getEnv('CONFIGURATION_EXPRESS_ORIGIN_WHITELIST') || '')
        .split(',')
        .map(s => s.trim()),
      enableHTTPS: getEnv('CONFIGURATION_EXPRESS_ENABLE_HTTPS') === 'true',
      PassportSecret: getEnv('CONFIGURATION_EXPRESS_PASSPORT_SECRET') || 'change me',
    },
    Kompressor: {
      Enabled: getEnv('CONFIGURATION_KOMPRESSOR_ENABLED') === 'true',
      Hostname: getEnv('CONFIGURATION_KOMPRESSOR_HOSTNAME') || 'kompressor',
      Port: parseInt(getEnv('CONFIGURATION_KOMPRESSOR_PORT') || '7999', 10),
    },
    Extensions: {},
  };

  const keepUppercase = ['DB', 'HTTPS', 'SPARQL', 'SAML', 'API'];

  const extensionKeys = Object.keys(Bun.env).filter(key =>
    key.startsWith('CONFIGURATION_EXTENSION_'),
  );
  for (const key of extensionKeys) {
    // Capitalized extension name
    const extensionName = capitalize(key.split('_').at(2));
    if (!extensionName) continue;

    const envValue = getEnv(key);
    if (!envValue) continue;

    const envKey = key
      .split('_')
      .slice(3)
      .map(v => capitalize(v, { keepUppercase }))
      .join('');

    DefaultConfiguration.Extensions ??= {};
    DefaultConfiguration.Extensions[extensionName] ??= {};
    DefaultConfiguration.Extensions[extensionName][envKey] = envValue;
  }

  if (CommandLineArguments.printEnvVars) {
    log(`--printEnvVars:
Environment variables used by the server:\n${environmentVariables.join('\n')}
`);
  }

  info('Loading configuration');

  try {
    info(`Config file path: ${ConfigFile}`);

    const configOnDisk = await Bun.file(`${ConfigFile}`).json();
    const confObj = deepmerge<IConfiguration>(DefaultConfiguration, configOnDisk);

    if (
      confObj.Uploads.TempDirectory.includes('../') ||
      confObj.Uploads.UploadDirectory.includes('../')
    ) {
      throw new Error('Upload path contains ../, but traversing up is not supported');
    }

    info('Configuration loaded from file');

    return confObj;
  } catch (error) {
    err(`Failed loading configuration file. Falling back to default configuration ${error}`);
    log('Configuration loaded from defaults');
    return DefaultConfiguration;
  }
};

const Configuration = await LoadConfig();

export { Configuration };
