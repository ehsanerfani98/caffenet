import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QUEUE_TOKEN } from './interfaces/queue.interface';
import { DatabaseQueue } from './drivers/database.queue';
import { DeploymentProfileService } from '../config/deployment-profile.service';
import { PrismaService } from '../database/prisma.service';

/**
 * Queue module — exposes a single IQueue provider.
 *
 * Driver is selected via QUEUE_DRIVER env var:
 *  - 'database' (default for shared hosting): jobs stored in MySQL `jobs` table,
 *    processed by a cron-launched worker CLI.
 *  - 'redis' (VPS): BullMQ backed by Redis, processed by a PM2 daemon.
 *
 * Both drivers implement the same IQueue interface.
 */
@Global()
@Module({
  providers: [
    {
      provide: QUEUE_TOKEN,
      inject: [ConfigService, DeploymentProfileService, PrismaService],
      useFactory: (
        _config: ConfigService,
        profile: DeploymentProfileService,
        prisma: PrismaService,
      ): DatabaseQueue => {
        // NOTE: When QUEUE_DRIVER=redis, replace with RedisQueue (BullMQ).
        // RedisQueue will be implemented in Phase 11. For Phase 1 we ship with
        // the database driver which is the safe default and works on both profiles.
        if (profile.queueDriver === 'redis') {
          // TODO Phase 11: return new RedisQueue(config);
        }
        return new DatabaseQueue(prisma);
      },
    },
  ],
  exports: [QUEUE_TOKEN],
})
export class QueueModule {}
