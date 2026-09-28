import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Session service — manages user sessions (devices, browsers, IPs).
 *
 * Sessions are created by AuthService.issueTokens() and revoked via this service.
 * A user can have multiple active sessions (one per device/browser).
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all active sessions for a user.
   * The 'current' session (by refresh token) is flagged for UI.
   */
  async listUserSessions(userId: string, currentRefreshToken?: string) {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId: BigInt(userId),
        status: 'active',
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: 'desc' },
      select: {
        id: true,
        uuid: true,
        userAgent: true,
        ip: true,
        lastUsedAt: true,
        createdAt: true,
        expiresAt: true,
        // NOTE: refreshTokenHash is intentionally NOT selected (security)
      },
    });

    return sessions.map((s) => ({
      id: s.id.toString(),
      uuid: s.uuid,
      userAgent: s.userAgent,
      ip: s.ip,
      lastUsedAt: s.lastUsedAt,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      // TODO: detect "current" by comparing refresh token hash (would need argon2.verify per session)
      // For now, we just return all sessions — frontend can mark "current" based on its own state
      isCurrent: false,
    }));
  }

  /**
   * Revoke a specific session by ID.
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.session.findFirst({
      where: {
        id: BigInt(sessionId),
        userId: BigInt(userId),
        status: 'active',
      },
    });
    if (!session) {
      throw new NotFoundException('نشست یافت نشد یا قبلاً باطل شده است');
    }
    await this.prisma.session.update({
      where: { id: session.id },
      data: { status: 'revoked', revokedAt: new Date() },
    });
    this.logger.log(`Session ${session.uuid} revoked by user ${userId}`);
  }

  /**
   * Revoke all sessions EXCEPT the current one (identified by refresh token).
   */
  async revokeAllExceptCurrent(userId: string, currentRefreshToken: string): Promise<number> {
    const sessions = await this.prisma.session.findMany({
      where: { userId: BigInt(userId), status: 'active' },
    });
    const argon2 = require('argon2');
    let currentId: bigint | null = null;
    for (const s of sessions) {
      if (await argon2.verify(s.refreshTokenHash, currentRefreshToken)) {
        currentId = s.id;
        break;
      }
    }
    const result = await this.prisma.session.updateMany({
      where: {
        userId: BigInt(userId),
        status: 'active',
        ...(currentId ? { id: { not: currentId } } : {}),
      },
      data: { status: 'revoked', revokedAt: new Date() },
    });
    this.logger.log(`Revoked ${result.count} sessions for user ${userId} (kept current)`);
    return result.count;
  }

  /**
   * Cleanup expired sessions (called by worker).
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: {
        status: 'active',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'expired' },
    });
    return result.count;
  }
}
