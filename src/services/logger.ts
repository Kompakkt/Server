import { ensureFileSync, statSync, writeFileSync } from 'fs-extra';
import { join } from 'path';
import { inspect } from 'util';
import { LogLevel } from '../enums';
import { Environment, RootDirectory } from '../environment';

const _autosaveInterval = 30000;
const maxStackSize = 128;

// TODO: rotating log files

const stack: Set<string> = new Set([]);
const path = join(RootDirectory, 'server.log');
const getDate = () => {
  const now = new Date();
  return now.toISOString();
};

const prepareContent = (...content: any) => {
  const result = new Array<string>();
  for (const element of content) {
    result.push(
      typeof element === 'object'
        ? `${inspect(element, { showHidden: false, depth: undefined })}`
        : element,
    );
  }
  return result;
};

const shouldWrite = () => {
  if (stack.size >= maxStackSize) writeToLog();
};

const writeToLog = () => {
  ensureFileSync(path);
  let lines = '';
  stack.forEach((line: string) => {
    lines += `${line}\n`;
  });
  const sizeBefore = statSync(path).size;
  writeFileSync(path, lines, { flag: 'as' });
  const written = statSync(path).size - sizeBefore;

  if (written <= 0) return;
  // console.log(`${written} bytes written to log. String bytelength: ${Buffer.byteLength(lines)}`);
  if (written === Buffer.byteLength(lines)) {
    // console.log('Log looks like a success. Clearing log stack');
    stack.clear();
  }
};

setInterval(() => writeToLog(), _autosaveInterval);

const info = (...content: any) => {
  const lines = [`[INFO|${getDate()}]`, ...prepareContent(...content)].join('\n');
  stack.add(lines);
  if (Environment.logLevel >= LogLevel.Info) console.log(lines);
  shouldWrite();
};

const log = (...content: any) => {
  const lines = [`[LOG|${getDate()}]`, ...prepareContent(...content)].join('\n');
  stack.add(lines);
  if (Environment.logLevel >= LogLevel.Log) console.log(lines);
  shouldWrite();
};

const warn = (...content: any) => {
  const lines = [`[WARN|${getDate()}]`, ...prepareContent(...content)].join('\n');
  stack.add(lines);
  if (Environment.logLevel >= LogLevel.Warn) console.log(lines);
  shouldWrite();
};

const err = (...content: any) => {
  const _stack = new Error().stack;
  const lines = [
    `[ERR|${getDate()}]`,
    _stack ?? 'No stack available',
    ...prepareContent(...content),
  ].join('\n');
  stack.add(lines);
  if (Environment.logLevel >= LogLevel.Error) console.log(lines);
  shouldWrite();
};

process.on('exit', code => {
  log(`Exiting with code ${code}`);
  writeToLog();
});

process.on('uncaughtException', error => err(error));
process.on('unhandledRejection', (reason, promise) => {
  warn(reason);
  warn(promise);
});
process.on('warning', warning => warn(warning));

const Logger = { info, log, warn, err };
export { Logger, info, log, warn, err };
