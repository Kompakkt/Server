import hash from 'object-hash';
import { Configuration } from './configuration';
import { log } from './logger';

const { Hostname: host, Port: port, DBOffset: offset } = Configuration.Redis;

export class CacheClient {
  private redis: Bun.RedisClient;
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
    const client = new Bun.RedisClient(`redis://${host}:${port}/${db}`);
    this.redis = client;
    this.defaultSeconds = defaultSeconds;
  }

  public async waitForConnection() {
    return await this.redis.connect();
  }

  public async flush() {
    return this.redis
      .send('FLUSHDB', [])
      .then(() => log(`Flushed Redis DB ${this.db}`))
      .catch(err => err('Failed to flush Redis DB', err));
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

  public async scan<T>(key: string, callback: (key: string) => Promise<T>) {
    const matches: Promise<T>[] = [];
    let cursor = '0';

    do {
      const result = await this.redis.send('SCAN', [cursor, 'MATCH', key, 'COUNT', '100']);
      cursor = result[0];
      matches.push(...result[1].map((k: string) => callback(k)));
    } while (cursor !== '0');

    return await Promise.all(matches);
  }

  public async getAll<T>(key: string) {
    const matches = await this.scan(key, async (key: string) => this.get<T>(key));
    return await Promise.all(matches);
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
// Cache additional information when resolving objects
export const resolveCache = new CacheClient(offset + 4, 60);
// Cache explore requests
export const exploreCache = new CacheClient(offset + 5, 60);

// MD5 Checksum cache for uploads
export const md5Cache = new CacheClient(offset + 6, -1);

export const pluginCache = new CacheClient(offset + 7, 60);
