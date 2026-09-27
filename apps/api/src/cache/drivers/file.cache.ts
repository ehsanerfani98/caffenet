import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { ICache } from '../interfaces/cache.interface';

/**
 * File-based cache driver — for shared hosting profile.
 * Stores cache entries as JSON files in storage/cache/
 * Each key → one file: storage/cache/<sha256(key)>.json
 *
 * Performance:
 *  - Good for low-volume, slow-changing data (settings, permission lists)
 *  - Not suitable for high-frequency cache hits
 *
 * When CACHE_DRIVER=redis is set, this driver is replaced by RedisCache.
 */
@Injectable()
export class FileCache implements ICache, OnModuleInit {
  private readonly logger = new Logger(FileCache.name);
  private cacheDir: string;

  constructor() {
    this.cacheDir = resolve(process.cwd(), 'storage', 'cache');
  }

  async onModuleInit() {
    await fs.mkdir(this.cacheDir, { recursive: true });
    this.logger.log(`📁 File cache initialized at ${this.cacheDir}`);
  }

  private filePath(key: string): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    return join(this.cacheDir, `${hash}.json`);
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    try {
      const content = await fs.readFile(this.filePath(key), 'utf8');
      const entry = JSON.parse(content) as { value: T; expiresAt?: number };
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        await fs.unlink(this.filePath(key)).catch(() => undefined);
        return undefined;
      }
      return entry.value;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      this.logger.error(`Cache get error for key ${key}: ${(err as Error).message}`);
      return undefined;
    }
  }

  async set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const entry = {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    };
    await fs.writeFile(this.filePath(key), JSON.stringify(entry), 'utf8');
  }

  async delete(key: string): Promise<void> {
    await fs.unlink(this.filePath(key)).catch(() => undefined);
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    // For file-based cache, we can't easily filter by prefix without scanning all files
    // This is a limitation — when using prefix-based cache invalidation heavily,
    // prefer Redis.
    this.logger.warn(`deleteByPrefix('${prefix}') not efficiently supported by FileCache — use Redis for hot caches`);
    // As a fallback, clear all cache (aggressive)
    await this.clear();
  }

  async clear(): Promise<void> {
    const files = await fs.readdir(this.cacheDir).catch(() => []);
    await Promise.all(files.map((f) => fs.unlink(join(this.cacheDir, f)).catch(() => undefined)));
  }

  async increment(key: string, by: number = 1): Promise<number> {
    const current = (await this.get<number>(key)) ?? 0;
    const next = current + by;
    await this.set(key, next);
    return next;
  }

  async has(key: string): Promise<boolean> {
    try {
      await fs.access(this.filePath(key));
      return true;
    } catch {
      return false;
    }
  }
}
