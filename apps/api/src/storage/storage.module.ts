import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STORAGE_TOKEN } from './interfaces/storage.interface';
import { LocalStorage } from './drivers/local.storage';
import { DeploymentProfileService } from '../config/deployment-profile.service';

/**
 * Storage module — exposes a single IStorage provider.
 *
 * Driver is selected via STORAGE_DRIVER env var:
 *  - 'local' (default for shared hosting): files stored in local filesystem
 *  - 's3' (VPS): files stored in S3-compatible storage (MinIO, AWS S3, DO Spaces)
 *
 * Both drivers implement the same IStorage interface.
 */
@Global()
@Module({
  providers: [
    {
      provide: STORAGE_TOKEN,
      inject: [ConfigService, DeploymentProfileService],
      useFactory: (config: ConfigService, profile: DeploymentProfileService): LocalStorage => {
        if (profile.storageDriver === 's3') {
          // TODO Phase 16: implement S3Storage (AWS SDK v3)
        }
        return new LocalStorage(config);
      },
    },
  ],
  exports: [STORAGE_TOKEN],
})
export class StorageModule {}
