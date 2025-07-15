import deepmerge from 'deepmerge';
import { ConfigFile } from './environment';
import { err, info, log, warn } from './logger';
import { CommandLineArguments } from './arguments';
import { capitalize } from './util/string-helpers';
import { randomBytes } from 'node:crypto';

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

export interface IServerConfiguration {
  PublicURL: string;
  MonitoringToken: string;
}

export interface IMailerConfiguration {
  Host: string;
  Port: number;
  Target: {
    contact: string;
    upload: string;
    bugreport: string;
  };
  Auth?: {
    User: string;
    Pass: string;
  };
  Secure?: boolean;
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
  Server: IServerConfiguration;
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
  const environmentVariables = new Set<string>();

  const getEnv = (key: string): string | undefined => {
    const value = Bun.env[key];
    environmentVariables.add(key);
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
      ClientURL: getEnv('CONFIGURATION_MONGO_CLIENT_URL') || undefined,
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
    Server: {
      PublicURL: getEnv('CONFIGURATION_SERVER_PUBLIC_URL') || 'http://localhost',
      MonitoringToken:
        getEnv('CONFIGURATION_SERVER_MONITORING_TOKEN') || randomBytes(32).toString('hex'),
    },
    Kompressor: {
      Enabled: getEnv('CONFIGURATION_KOMPRESSOR_ENABLED') === 'true' || true,
      Hostname: getEnv('CONFIGURATION_KOMPRESSOR_HOSTNAME') || 'kompressor',
      Port: parseInt(getEnv('CONFIGURATION_KOMPRESSOR_PORT') || '7999', 10),
    },
    Mailer: {
      Host: getEnv('CONFIGURATION_MAILER_HOST') || 'localhost',
      Port: parseInt(getEnv('CONFIGURATION_MAILER_PORT') || '25', 10),
      Target: {
        contact: getEnv('CONFIGURATION_MAILER_TARGET_CONTACT') || 'contact@kompakkt.de',
        upload: getEnv('CONFIGURATION_MAILER_TARGET_UPLOAD') || 'upload@kompakkt.de',
        bugreport: getEnv('CONFIGURATION_MAILER_TARGET_BUGREPORT') || 'bugreport@kompakkt.de',
      },
      Auth: ['CONFIGURATION_MAILER_AUTH_USER', 'CONFIGURATION_MAILER_AUTH_PASS'].every(
        key => !!getEnv(key),
      )
        ? {
            User: getEnv('CONFIGURATION_MAILER_AUTH_USER') || 'user',
            Pass: getEnv('CONFIGURATION_MAILER_AUTH_PASS') || 'pass',
          }
        : undefined,
      Secure: getEnv('CONFIGURATION_MAILER_SECURE') === 'true',
    },
    Extensions: {},
  };

  const keepUppercase = ['DB', 'HTTPS', 'SPARQL', 'SAML', 'API', 'URL', 'TTL'];

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
    const joinedEnvVars = Array.from(environmentVariables)
      .sort((a, b) => a.localeCompare(b))
      .join('\n');
    log(`--printEnvVars:
Environment variables used by the server:\n${joinedEnvVars}
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

info(`Monitoring token: ${Configuration.Server.MonitoringToken}`);

if (Configuration.Server.PublicURL.includes('localhost')) {
  warn(
    `This servers public URL is currently configured to be on localhost. Make sure this is only for development purposes, as data created while configured to localhost might be impacted negatively when switching to a public facing URL later on.`,
  );
}

export { Configuration };
