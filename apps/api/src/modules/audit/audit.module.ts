import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditInterceptor } from './audit.interceptor';
import { AuditEventListener } from './audit.event-listener';

@Global()
@Module({
  providers: [AuditService, AuditInterceptor, AuditEventListener],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}
