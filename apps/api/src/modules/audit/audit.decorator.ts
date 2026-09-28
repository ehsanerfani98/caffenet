import { SetMetadata } from '@nestjs/common';
import { AuditAction } from '@caffenet/shared';

export const AUDIT_LOG_KEY = 'audit_log';

export interface AuditLogMetadata {
  /** What action — e.g. AuditAction.LOGIN, AuditAction.WALLET_ADJUST */
  action: AuditAction;
  /** What entity is being acted on — e.g. 'user', 'wallet', 'payment' */
  entity: string;
  /**
   * Function to extract the entity ID from request — defaults to req.params.id
   * Example: (req) => req.body.uuid
   */
  entityIdExtractor?: (req: unknown) => string | undefined;
  /**
   * Function to extract old data before mutation — only for @UseInterceptors(AuditInterceptor)
   * Use when you need a "before" snapshot (e.g. price change, role change).
   */
  oldDataExtractor?: (req: unknown) => Promise<Record<string, unknown>> | Record<string, unknown>;
}

export const AuditLog = (meta: AuditLogMetadata) => SetMetadata(AUDIT_LOG_KEY, meta);
