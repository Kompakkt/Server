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

  constructor(db: number, defaultSeconds = 60) {
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

  public async get<T extends unknown>(key: string) {
    return this.redis.get(key).then(value => (value ? (JSON.parse(value) as T) : undefined));
  }

  public async set(key: string, value: any, seconds = this.defaultSeconds) {
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
export const sessionCache = new CacheClient(offset + 3);
// Cache information about who uploaded files
export const uploadCache = new CacheClient(offset + 4, 3.6e4);
// Cache explore requests
export const exploreCache = new CacheClient(offset + 5, 300);
