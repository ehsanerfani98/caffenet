import { Global, Module } from '@nestjs/common';
import { DeploymentProfileService } from './deployment-profile.service';

/**
 * DeploymentProfileModule — global provider for DeploymentProfileService.
 *
 * Infrastructure modules (Cache, Queue, Storage) and feature controllers
 * (Health) all select behaviour based on the active deployment profile,
 * so the service is registered once here and made available app-wide.
 */
@Global()
@Module({
  providers: [DeploymentProfileService],
  exports: [DeploymentProfileService],
})
export class DeploymentProfileModule {}
