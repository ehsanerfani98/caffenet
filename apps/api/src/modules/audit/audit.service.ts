import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../database/prisma.service';
import { AuditAction } from '@caffenet/shared';

export interface AuditLogEntry {
  userId?: string;
  action: AuditAction | string;
  entity: string;
  entityId?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Audit service — writes audit log entries to the `audit_logs` table.
 *
 * Audit logs are IMMUTABLE — no update/delete API exposed.
 * Sensitive fields (passwords, secrets) are redacted automatically via redactSecrets().
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private static readonly SENSITIVE_KEYS = [
    'password',
    'passwordHash',
    'currentPassword',
    'newPassword',
    'secret',
    'token',
    'refreshToken',
    'accessToken',
    'apiKey',
    'privateKey',
    'cookie',
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write an audit log entry. Fire-and-forget (caller doesn't need to await).
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          uuid: uuidv4(),
          userId: entry.userId ? BigInt(entry.userId) : null,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          oldData: entry.oldData ? (this.redactSecrets(entry.oldData) as object) : undefined,
          newData: entry.newData ? (this.redactSecrets(entry.newData) as object) : undefined,
          ip: entry.ip,
          userAgent: entry.userAgent,
          requestId: entry.requestId,
          metadata: (entry.metadata ?? undefined) as object | undefined,
        },
      });
    } catch (err) {
      // Audit failure should NEVER break the user-facing operation
      this.logger.error(
        `Failed to write audit log: ${(err as Error).message}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }

  /**
   * Query audit logs (admin view).
   */
  async list(params: {
    userId?: string;
    action?: string;
    entity?: string;
    entityId?: string;
    fromDate?: Date;
    toDate?: Date;
    page?: number;
    perPage?: number;
  }) {
    const page = params.page ?? 1;
    const perPage = Math.min(params.perPage ?? 50, 100);

    const where = {
      AND: [
        params.userId ? { userId: BigInt(params.userId) } : {},
        params.action ? { action: params.action } : {},
        params.entity ? { entity: params.entity } : {},
        params.entityId ? { entityId: params.entityId } : {},
        params.fromDate ? { createdAt: { gte: params.fromDate } } : {},
        params.toDate ? { createdAt: { lte: params.toDate } } : {},
      ],
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          user: {
            select: { id: true, phone: true, fullName: true, uuid: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: items.map((a) => ({
        ...a,
        id: a.id.toString(),
        userId: a.userId?.toString() ?? null,
      })),
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  /**
   * Recursively redact sensitive values from an object.
   */
  private redactSecrets(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = AuditService.SENSITIVE_KEYS.some((s) =>
        lowerKey.includes(s.toLowerCase()),
      );
      if (isSensitive) {
        result[key] = '[REDACTED]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.redactSecrets(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}
