import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_TOKEN } from './interfaces/cache.interface';
import { FileCache } from './drivers/file.cache';
import { RedisCache } from './drivers/redis.cache';
import { DeploymentProfileService } from '../config/deployment-profile.service';

/**
 * Cache module — exposes a single ICache provider.
 * The driver is selected via env var CACHE_DRIVER:
 *  - 'file' (default for shared hosting)
 *  - 'redis' (VPS)
 */
@Global()
@Module({
  providers: [
    {
      provide: CACHE_TOKEN,
      inject: [ConfigService, DeploymentProfileService],
      useFactory: (config: ConfigService, profile: DeploymentProfileService) => {
        const driver = profile.cacheDriver;
        if (driver === 'redis') {
          return new RedisCache(config);
        }
        return new FileCache();
      },
    },
  ],
  exports: [CACHE_TOKEN],
})
export class CacheModule {}
