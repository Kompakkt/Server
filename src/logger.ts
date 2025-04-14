import { Logger } from 'tslog';
import { createStream } from 'rotating-file-stream';

const stream = createStream('server.log', {
  interval: '1d',
  size: '10M',
  compress: 'gzip',
  path: './logs',
});

const logger = new Logger({
  name: 'Server',
  minLevel: 0,
  type: 'pretty',
});
logger.attachTransport(obj => {
  stream.write(JSON.stringify(obj) + '\n');
});

export const log = (...args: any[]) => logger.silly(...args);
export const info = (...args: any[]) => logger.info(...args);
export const warn = (...args: any[]) => logger.warn(...args);
export const err = (...args: any[]) => logger.error(...args);
