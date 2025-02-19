import { join } from 'node:path';
import { inspect } from 'node:util';
import { RootDirectory } from './environment';

const _autosaveInterval = 30000;
const maxStackSize = 128;

// TODO: rotating log files
export enum LogLevel {
  Error = 1,
  Warn = 2,
  Log = 3,
  Info = 4,
  All = 5,
}
const logLevel = LogLevel.All;

const stack: Set<string> = new Set([]);
const path = join(RootDirectory, 'server.log');
const getDate = () => {
  const now = new Date();
  return now.toISOString();
};

const prepareContent = (...content: unknown[]) => {
  const result = new Array<string>();
  for (const element of content) {
    if (!element) continue;
    result.push(
      typeof element === 'object'
        ? `${inspect(element, { showHidden: false, depth: undefined })}`
        : element.toString(),
    );
  }
  return result;
};

const shouldWrite = () => {
  if (stack.size >= maxStackSize) writeToLog();
};

const outputFile = Bun.file(path);
const outputWriter = outputFile.writer({
  highWaterMark: 1024 * 1024, // 1MB
});
const writeToLog = () => {
  const sizeBefore = Bun.file(path).size;
  let writtenChunks = '';
  for (const line of stack) {
    const chunk = `${line}\n`;
    outputWriter.write(chunk);
    writtenChunks += chunk;
  }
  outputWriter.flush();
  const written = Bun.file(path).size - sizeBefore;

  if (written <= 0) return;
  if (written === Buffer.byteLength(writtenChunks)) {
    stack.clear();
  }
};

setInterval(() => writeToLog(), _autosaveInterval);

const info = (...content: unknown[]) => {
  const lines = [`[INFO|${getDate()}]`, ...prepareContent(...content)].join('\n');
  stack.add(lines);
  if (logLevel >= LogLevel.Info) console.log(lines);
  shouldWrite();
};

const log = (...content: unknown[]) => {
  const lines = [`[LOG|${getDate()}]`, ...prepareContent(...content)].join('\n');
  stack.add(lines);
  if (logLevel >= LogLevel.Log) console.log(lines);
  shouldWrite();
};

const warn = (...content: unknown[]) => {
  const lines = [`[WARN|${getDate()}]`, ...prepareContent(...content)].join('\n');
  stack.add(lines);
  if (logLevel >= LogLevel.Warn) console.log(lines);
  shouldWrite();
};

const err = (...content: unknown[]) => {
  const _stack = new Error().stack;
  const lines = [
    `[ERR|${getDate()}]`,
    _stack ?? 'No stack available',
    ...prepareContent(...content),
  ].join('\n');
  stack.add(lines);
  if (logLevel >= LogLevel.Error) console.log(lines);
  shouldWrite();
  return false;
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

export { err, info, log, warn };
