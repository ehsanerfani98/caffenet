import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { ICache } from '../interfaces/cache.interface';

/**
 * Redis cache driver — for VPS profile (or shared hosting if Redis available).
 * Atomic, fast, supports TTL, prefix-based invalidation, atomic counters.
 */
@Injectable()
export class RedisCache implements ICache, OnModuleInit {
  private readonly logger = new Logger(RedisCache.name);
  private client!: IORedis;
  private readonly prefix = 'caffenet:cache:';

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('REDIS_URL');
    if (!url) {
      throw new Error('REDIS_URL is required when using Redis cache driver');
    }
    this.client = new IORedis(url, { lazyConnect: false, maxRetriesPerRequest: 3 });
    this.client.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
    this.client.on('connect', () => this.logger.log('✅ Redis cache connected'));
  }

  private fullKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const raw = await this.client.get(this.fullKey(key));
    if (!raw) return undefined;
    return JSON.parse(raw) as T;
  }

  async set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.set(this.fullKey(key), serialized, 'EX', ttlSeconds);
    } else {
      await this.client.set(this.fullKey(key), serialized);
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.del(this.fullKey(key));
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    const fullPrefix = `${this.prefix}${prefix}`;
    const keys = await this.client.keys(`${fullPrefix}*`);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  async clear(): Promise<void> {
    const keys = await this.client.keys(`${this.prefix}*`);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  async increment(key: string, by: number = 1): Promise<number> {
    const result = await this.client.incrby(this.fullKey(key), by);
    return result;
  }

  async has(key: string): Promise<boolean> {
    const exists = await this.client.exists(this.fullKey(key));
    return exists === 1;
  }
}
