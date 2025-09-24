import { Logger } from 'tslog';
import { createStream } from 'rotating-file-stream';
import { join } from 'node:path';
import { RootDirectory } from './environment';

const stream = createStream('server.log', {
  interval: '1d',
  size: '10M',
  compress: 'gzip',
  path: join(RootDirectory, 'logs'),
});

const logger = new Logger({
  name: 'Server',
  minLevel: 0,
  type: 'pretty',
});
logger.attachTransport(obj => {
  stream.write(JSON.stringify(obj) + '\n');
});

const mapLogObjects = (arg: unknown) => {
  const message = (() => {
    try {
      if (typeof arg === 'function') {
        return arg.toString();
      }
      if (typeof arg === 'object') {
        if (arg instanceof Error) {
          return (arg.stack ?? arg.message).replaceAll('\n', ' ');
        }
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    } catch {
      return '[unserializable]' + new Error().stack?.replaceAll('\n', ' ');
    }
  })();
  return message.replaceAll(/\s+/g, ' ').replaceAll(__dirname, '').trim();
};

export const log = (...args: unknown[]) => logger.silly(...args.map(mapLogObjects));
export const info = (...args: unknown[]) => logger.info(...args.map(mapLogObjects));
export const warn = (...args: unknown[]) => logger.warn(...args.map(mapLogObjects));
export const err = (...args: unknown[]) => logger.error(...args.map(mapLogObjects));
