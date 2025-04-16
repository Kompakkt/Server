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

export const log = (...args: unknown[]) => logger.silly(...args);
export const info = (...args: unknown[]) => logger.info(...args);
export const warn = (...args: unknown[]) => logger.warn(...args);
export const err = (...args: unknown[]) => logger.error(...args);
