import { ensureFileSync, writeFileSync, statSync } from 'fs-extra';
import { RootDirectory, Environment } from '../environment';
import { LogLevel } from '../enums';
import { inspect } from 'util';
import { join } from 'path';

const Logger = {
  path: join(RootDirectory, 'server.log'),
  stack: new Set([]),
  autosave: setInterval(() => Logger.writeToLog(), 30000),
  info: (content) => {
    const message = `[INFO|${Logger.getDate()}]\t${Logger.prepareContent(content)}`;
    Logger.stack.add(message);
    if (Environment.logLevel >= LogLevel.Info) console.log(message);
    Logger.shouldWrite();
  },
  log: (content) => {
    const message = `[LOG|${Logger.getDate()}]\t${Logger.prepareContent(content)}`;
    Logger.stack.add(message);
    if (Environment.logLevel >= LogLevel.Log) console.log(message);
    Logger.shouldWrite();
  },
  warn: (content) => {
    const message = `[WARN|${Logger.getDate()}]\t${Logger.prepareContent(content)}`;
    Logger.stack.add(message);
    if (Environment.logLevel >= LogLevel.Warn) console.log(message);
    Logger.shouldWrite();
  },
  err: (content) => {
    const message = `[ERR|${Logger.getDate()}]\t${Logger.prepareContent(content)}`;
    Logger.stack.add(message);
    if (Environment.logLevel >= LogLevel.Error) console.log(message);
    Logger.shouldWrite();
  },
  getDate: () => {
    const now = new Date();
    return now.toISOString();
  },
  prepareContent: (content) => {
    return (typeof (content) === 'object')
      ? `\n${inspect(content, { showHidden: false, depth: null })}`
      : content;
  },
  shouldWrite: () => {
    if (Logger.stack.size >= 128) {
      Logger.writeToLog();
    }
  },
  writeToLog: () => {
    ensureFileSync(Logger.path);
    let lines = '';
    Logger.stack.forEach(line => {
      lines += `${line}\n`;
    });
    const sizeBefore = statSync(Logger.path).size;
    writeFileSync(Logger.path, lines, { flag: 'as' });
    const written = statSync(Logger.path).size - sizeBefore;

    if (written > 0) {
      console.log(`${written} bytes written to log. String bytelength: ${Buffer.byteLength(lines)}`);
      if (written === Buffer.byteLength(lines)) {
        console.log(`Log looks like a success. Clearing log stack`);
        Logger.stack.clear();
      }
    }
  }
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
