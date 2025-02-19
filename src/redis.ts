import { Redis } from 'ioredis';
import hash from 'object-hash';
import { Configuration } from './configuration';
import { log } from './logger';

const { Hostname: host, Port: port, DBOffset: offset } = Configuration.Redis;

export class CacheClient {
  private redis: Redis;
  private db: number;
  private defaultSeconds: number;
  public hash = hash;

  constructor(db: number, defaultSeconds: number) {
    this.db = db;
    this.redis = new Redis({ db, host, port });
    this.defaultSeconds = defaultSeconds;
    log(`Initialized Redis using DB ${db}`);
  }

  get client() {
    return this.redis;
  }

  public async flush() {
    return this.redis.flushdb().then(() => log(`Flushed Redis DB ${this.db}`));
  }

  public async del(key: string) {
    return this.redis.del(key);
  }

  public async has(key: string) {
    return this.redis.get(key).then(value => !!value);
  }

  public async get<T>(key: string) {
    return this.redis.get(key).then(value => (value ? (JSON.parse(value) as T) : undefined));
  }

  public async getAll<T>(key: string) {
    const matches = await this.redis.keys(key);
    return Promise.all(matches.map(m => this.get<T>(m)));
  }

  public async set(key: string, value: any, seconds = this.defaultSeconds) {
    if (seconds <= 0) {
      return this.redis.set(key, JSON.stringify(value));
    }
    return this.redis.set(key, JSON.stringify(value), 'EX', seconds);
  }

  public async refresh(key: string, seconds = this.defaultSeconds) {
    return this.redis.expire(key, seconds);
  }

  public async incr(key: string) {
    return this.redis.incr(key);
  }
}

// Repo/Entity MongoDB Cache
export const entitiesCache = new CacheClient(offset + 1, 1);
// User/Account MongoDB Cache
export const usersCache = new CacheClient(offset + 2, 1);
// User/Account Session Cache
export const sessionCache = new CacheClient(offset + 3, 60);
// Cache information about who uploaded files
export const uploadCache = new CacheClient(offset + 4, 3.6e4);
// Cache explore requests
export const exploreCache = new CacheClient(offset + 5, 300);

// MD5 Checksum cache for uploads
export const md5Cache = new CacheClient(offset + 6, -1);
