import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditService } from './audit.service';
import { AuditAction } from '@caffenet/shared';

/**
 * Audit event listener — subscribes to domain events emitted via EventBusService
 * and writes audit log entries for each.
 *
 * This decouples audit logging from business logic — domain modules just emit
 * events; this listener handles the audit logging.
 *
 * Note: For specific endpoints that need old/new data diffs (e.g. price changes),
 * use the @AuditLog() decorator + AuditInterceptor instead.
 */
@Injectable()
export class AuditEventListener implements OnModuleInit {
  private readonly logger = new Logger(AuditEventListener.name);

  constructor(private readonly audit: AuditService) {}

  onModuleInit() {
    this.logger.log('👂 Audit event listener ready');
  }

  @OnEvent('audit.log')
  async handleAuditLog(payload: {
    action: AuditAction;
    userId?: string;
    entity: string;
    entityId?: string;
    oldData?: Record<string, unknown>;
    newData?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
    requestId?: string;
    metadata?: Record<string, unknown>;
  }) {
    await this.audit.log(payload);
  }

  @OnEvent('auth.login.success')
  async handleLoginSuccess(payload: {
    userId: string;
    userUuid: string;
    ip?: string;
    userAgent?: string;
    requestId?: string;
    method?: 'password' | 'otp';
  }) {
    await this.audit.log({
      action: AuditAction.LOGIN,
      userId: payload.userId,
      entity: 'user',
      entityId: payload.userUuid,
      ip: payload.ip,
      userAgent: payload.userAgent,
      requestId: payload.requestId,
      metadata: { method: payload.method ?? 'password' },
    });
  }

  @OnEvent('auth.login.failed')
  async handleLoginFailed(payload: {
    identifier?: string;
    ip?: string;
    userAgent?: string;
    requestId?: string;
    reason: string;
  }) {
    // Failed login — log without user ID (user may not exist)
    await this.audit.log({
      action: AuditAction.LOGIN,
      entity: 'auth',
      entityId: payload.identifier,
      ip: payload.ip,
      userAgent: payload.userAgent,
      requestId: payload.requestId,
      metadata: {
        success: false,
        reason: payload.reason,
      },
    });
  }

  @OnEvent('auth.logout')
  async handleLogout(payload: {
    userId: string;
    userUuid: string;
    ip?: string;
    userAgent?: string;
  }) {
    await this.audit.log({
      action: AuditAction.LOGOUT,
      userId: payload.userId,
      entity: 'user',
      entityId: payload.userUuid,
      ip: payload.ip,
      userAgent: payload.userAgent,
    });
  }

  @OnEvent('auth.password.changed')
  async handlePasswordChanged(payload: { userId: string; userUuid: string; ip?: string }) {
    await this.audit.log({
      action: AuditAction.UPDATE,
      userId: payload.userId,
      entity: 'user',
      entityId: payload.userUuid,
      ip: payload.ip,
      metadata: { field: 'password' },
    });
  }

  @OnEvent('auth.password.reset')
  async handlePasswordReset(payload: { userId: string; userUuid: string; ip?: string }) {
    await this.audit.log({
      action: AuditAction.UPDATE,
      userId: payload.userId,
      entity: 'user',
      entityId: payload.userUuid,
      ip: payload.ip,
      metadata: { field: 'password', method: 'otp_reset' },
    });
  }

  @OnEvent('role.assigned')
  async handleRoleAssigned(payload: {
    userId: string;
    targetUserId: string;
    targetUserUuid: string;
    roleId: string;
    roleName: string;
    ip?: string;
    userAgent?: string;
  }) {
    await this.audit.log({
      action: AuditAction.ROLE_CHANGE,
      userId: payload.userId,
      entity: 'user_role',
      entityId: payload.targetUserUuid,
      newData: { roleId: payload.roleId, roleName: payload.roleName },
      ip: payload.ip,
      userAgent: payload.userAgent,
    });
  }

  @OnEvent('role.revoked')
  async handleRoleRevoked(payload: {
    userId: string;
    targetUserId: string;
    targetUserUuid: string;
    roleName: string;
    ip?: string;
  }) {
    await this.audit.log({
      action: AuditAction.ROLE_CHANGE,
      userId: payload.userId,
      entity: 'user_role',
      entityId: payload.targetUserUuid,
      oldData: { roleName: payload.roleName },
      ip: payload.ip,
    });
  }

  @OnEvent('setting.changed')
  async handleSettingChanged(payload: {
    userId: string;
    key: string;
    oldValue?: unknown;
    newValue?: unknown;
    ip?: string;
  }) {
    await this.audit.log({
      action: AuditAction.SETTING_CHANGE,
      userId: payload.userId,
      entity: 'system_setting',
      entityId: payload.key,
      oldData: { value: payload.oldValue },
      newData: { value: payload.newValue },
      ip: payload.ip,
    });
  }
}
