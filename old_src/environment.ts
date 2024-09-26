import { LogLevel } from './enums';

const Environment = {
  verbose: false,
  rootDirectory: `${__dirname}`,
  configFile: `${__dirname}/config.json`,
  logLevel: LogLevel.All,
};

const Verbose = Environment.verbose;
const RootDirectory = Environment.rootDirectory;
const ConfigFile = Environment.configFile;

export { Environment, Verbose, RootDirectory, ConfigFile };
