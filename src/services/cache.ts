import Redis from 'ioredis';
import hash from 'object-hash';

import { Logger } from './logger';

const redis = new Redis();
redis.flushall().then(() => Logger.log('Flushed Redis'));

const Cache = {
  flush: async () => redis.flushall(),
  del: async (key: string) => redis.del(key).then(res => res),
  get: async <T extends unknown>(key: string): Promise<T | undefined> =>
    redis.get(key).then(value => (value ? JSON.parse(value) : undefined)),
  set: async (key: string, value: any) => redis.set(key, JSON.stringify(value), 'EX', 3600),
  hash,
};

export { Cache };
