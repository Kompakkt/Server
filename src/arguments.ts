import { parseArgs } from 'node:util';

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    printEnvVars: {
      type: 'boolean',
    },
    help: {
      type: 'boolean',
    },
  },
  strict: false,
  allowPositionals: true,
});

export const CommandLineArguments = values;

if (CommandLineArguments.help) {
  console.log(
    `
Usage: ./server [options]
Options:
--printEnvVars   Print all environment variables used by the server (default: false)
  Note: If a configuration file is used, it will take precedence over environment variables.
  `.trim(),
  );
  process.exit(0);
}
