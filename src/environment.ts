const Environment = {
  verbose: false,
  rootDirectory: `${__dirname}`,
  configFile: `${__dirname}/config.json`,
  isE2eGenerator: Bun.env['KOMPAKKT_SERVER_IS_E2E']
    ? Bun.env['KOMPAKKT_SERVER_IS_E2E'] === 'true'
    : false,
};
console.info(`Environment: ${JSON.stringify(Environment)}`);

const Verbose = Environment.verbose;
const RootDirectory = Environment.rootDirectory;
const ConfigFile = Environment.configFile;

export { Environment, Verbose, RootDirectory, ConfigFile };
