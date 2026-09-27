import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeploymentProfile } from '@caffenet/shared';

/**
 * Loads deployment profile from env vars and exposes the active configuration.
 *
 * Two profiles are supported:
 * - 'shared' (default): file cache, DB queue, local storage, cron worker
 * - 'vps': Redis cache, BullMQ queue, S3 storage, PM2 worker
 */
@Injectable()
export class DeploymentProfileService implements OnModuleInit {
  private readonly logger = new Logger(DeploymentProfileService.name);
  private _profile!: DeploymentProfile;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this._profile = this.config.get<DeploymentProfile>('DEPLOYMENT_PROFILE', DeploymentProfile.SHARED)!;
    this.logger.log(`Deployment profile: ${this._profile}`);
    this.logger.log(`Cache driver: ${this.cacheDriver}`);
    this.logger.log(`Queue driver: ${this.queueDriver}`);
    this.logger.log(`Storage driver: ${this.storageDriver}`);
  }

  get profile(): DeploymentProfile {
    return this._profile;
  }

  get isShared(): boolean {
    return this._profile === DeploymentProfile.SHARED;
  }

  get isVps(): boolean {
    return this._profile === DeploymentProfile.VPS;
  }

  get cacheDriver(): 'file' | 'redis' {
    return this.config.get<'file' | 'redis'>('CACHE_DRIVER', 'file')!;
  }

  get queueDriver(): 'database' | 'redis' {
    return this.config.get<'database' | 'redis'>('QUEUE_DRIVER', 'database')!;
  }

  get storageDriver(): 'local' | 's3' {
    return this.config.get<'local' | 's3'>('STORAGE_DRIVER', 'local')!;
  }

  get workerMaxJobs(): number {
    return this.config.get<number>('WORKER_MAX_JOBS', 50)!;
  }

  get workerTimeoutSeconds(): number {
    return this.config.get<number>('WORKER_TIMEOUT_SECONDS', 55)!;
  }

  get workerQueueName(): string {
    return this.config.get<string>('WORKER_QUEUE_NAME', 'caffenet-jobs')!;
  }
}
