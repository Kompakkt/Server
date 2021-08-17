import Redis from 'ioredis';
import hash from 'object-hash';
import { Logger } from './logger';
import { Configuration } from './configuration';

const { Hostname: host, Port: port, DBOffset: offset } = Configuration.Redis;

class CacheClient {
  private redis: Redis.Redis;
  private db: number;
  private defaultSeconds: number;
  public hash = hash;

  constructor(db: number, defaultSeconds = 60) {
    this.db = db;
    this.redis = new Redis({ db, host, port });
    this.defaultSeconds = defaultSeconds;
    Logger.log(`Initialized Redis using DB ${db}`);
  }

  get client() {
    return this.redis;
  }

  public async flush() {
    return this.redis.flushdb().then(() => Logger.log(`Flushed Redis DB ${this.db}`));
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
}

// Repo/Entity MongoDB Cache
const RepoCache = new CacheClient(offset + 1);
// User/Account MongoDB Cache
const UserCache = new CacheClient(offset + 2);
// User/Account Session Cache
const SessionCache = new CacheClient(offset + 3);
// Cache information about who uploaded files
const UploadCache = new CacheClient(offset + 4, 3.6e4);

export { RepoCache, UserCache, SessionCache, UploadCache, CacheClient };
