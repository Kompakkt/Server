import { LogLevel } from './enums';

const Environment = {
  verbose: false,
  rootDirectory: `${__dirname}`,
  configFile: undefined,
  logLevel: LogLevel.Log
};

Environment['configFile'] = `${Environment.rootDirectory}/config.json`;

const Verbose = Environment.verbose;
const RootDirectory = Environment.rootDirectory;
const ConfigFile = Environment.configFile;

export { Environment, Verbose, RootDirectory, ConfigFile };
