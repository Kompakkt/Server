import { ensureFileSync, statSync, writeFileSync } from 'fs-extra';
import { join } from 'path';
import { inspect } from 'util';

import { LogLevel } from '../enums';
import { Environment, RootDirectory } from '../environment';

const _autosaveInterval = 30000;
const maxStackSize = 128;

const stack: Set<string> = new Set([]);

interface ILogger {
  stack: Set<string>;
  path: string;
  autosave: any;
  info(...content: any[]): any;
  log(...content: any[]): any;
  warn(...content: any[]): any;
  err(...content: any[]): any;
  getDate(): any;
  prepareContent(...content: any[]): any;
  shouldWrite(): any;
  writeToLog(): any;
}

const Logger: ILogger = {
  path: join(RootDirectory, 'server.log'),
  stack,
  autosave: setInterval(() => Logger.writeToLog(), _autosaveInterval),
  info: (...content) => {
    const message = `[INFO|${Logger.getDate()}]\t${Logger.prepareContent(content)}`;
    Logger.stack.add(message);
    if (Environment.logLevel >= LogLevel.Info) console.log(message);
    Logger.shouldWrite();
  },
  log: (...content) => {
    const message = `[LOG|${Logger.getDate()}]\t${Logger.prepareContent(content)}`;
    Logger.stack.add(message);
    if (Environment.logLevel >= LogLevel.Log) console.log(message);
    Logger.shouldWrite();
  },
  warn: (...content) => {
    const message = `[WARN|${Logger.getDate()}]\t${Logger.prepareContent(content)}`;
    Logger.stack.add(message);
    if (Environment.logLevel >= LogLevel.Warn) console.log(message);
    Logger.shouldWrite();
  },
  err: (...content) => {
    const _stack = new Error().stack;
    const message = `[ERR|${Logger.getDate()}]\n${_stack}\n${Logger.prepareContent(content)}`;
    Logger.stack.add(message);
    if (Environment.logLevel >= LogLevel.Error) console.log(message);
    Logger.shouldWrite();
  },
  getDate: () => {
    const now = new Date();
    return now.toISOString();
  },
  prepareContent: (...content) => {
    let result = '';
    for (const element of content) {
      result +=
        typeof element === 'object'
          ? `\n${inspect(element, { showHidden: false, depth: undefined })}`
          : element;
    }
    return result;
  },
  shouldWrite: () => {
    if (Logger.stack.size >= maxStackSize) {
      Logger.writeToLog();
    }
  },
  writeToLog: () => {
    ensureFileSync(Logger.path);
    let lines = '';
    Logger.stack.forEach((line: string) => {
      lines += `${line}\n`;
    });
    const sizeBefore = statSync(Logger.path).size;
    writeFileSync(Logger.path, lines, { flag: 'as' });
    const written = statSync(Logger.path).size - sizeBefore;

    if (written <= 0) return;
    // console.log(`${written} bytes written to log. String bytelength: ${Buffer.byteLength(lines)}`);
    if (written === Buffer.byteLength(lines)) {
      // console.log('Log looks like a success. Clearing log stack');
      Logger.stack.clear();
    }
  },
};

process.on('exit', code => {
  Logger.log(`Exiting with code ${code}`);
  Logger.writeToLog();
});

process.on('uncaughtException', error => Logger.err(error));
process.on('unhandledRejection', (reason, promise) => {
  Logger.warn(reason);
  Logger.warn(promise);
});
process.on('warning', warning => Logger.warn(warning));

export { Logger };
