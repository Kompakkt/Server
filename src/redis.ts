import hash from 'object-hash';
import { Configuration } from './configuration';
import { log } from './logger';
import { Redis } from 'ioredis';

const { Hostname: host, Port: port, DBOffset: offset } = Configuration.Redis;

export class CacheClient {
  private redis: Redis;
  private db: number;
  private defaultSeconds: number;
  public hash = hash;

  public static readonly takenDbs = new Set<number>();

  constructor(db: number, defaultSeconds: number) {
    if (CacheClient.takenDbs.has(db)) {
      throw new Error(`DB ${db} is already in use`);
    }
    CacheClient.takenDbs.add(db);
    this.db = db;
    const client = new Redis(`redis://${host}:${port}/${db}`);
    // TODO: Switch to Bun.RedisClient when its stable
    // TODO: Manually switch DB number until the following issue is fixed: https://github.com/oven-sh/bun/issues/19041
    /*client
      .send('select', [db.toString()])
      .then(() => {
        log(`Initialized Redis using DB ${db}`);
      })
      .catch(() => {
        log(`Failed to initialized DB ${db}`);
        });*/
    this.redis = client;
    this.defaultSeconds = defaultSeconds;
  }

  public async waitForConnection() {
    return await this.redis.connect();
  }

  public async flush() {
    return this.redis.flushdb().then(() => log(`Flushed Redis DB ${this.db}`));
    /* For Bun.RedisClient return this.redis
      .send('FLUSHDB', [])
      .then(() => log(`Flushed Redis DB ${this.db}`))
      .catch(err => err('Failed to flush Redis DB', err));*/
  }

  public async del(key: string) {
    return this.redis.del(key);
  }

  public async has(key: string) {
    return this.redis.get(key).then(value => !!value);
  }

  public async get<T>(key: string) {
    return this.redis.get(key).then(value => {
      if (!value) return undefined;
      return JSON.parse(value) as T;
    });
  }

  public async getAll<T>(key: string) {
    const matches = await this.redis.keys(key);
    return Promise.all(matches.map(m => this.get<T>(m)));
  }

  public async set(key: string, value: unknown, seconds = this.defaultSeconds) {
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
