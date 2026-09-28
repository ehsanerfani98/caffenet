import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateProfileDto } from './dto/user.dto';

/**
 * Users service — handles user profile management.
 *
 * Admin-only operations (list all users, ban, role assignment) are split into
 * a separate AdminUsersService in Phase 9 to keep this service focused on
 * self-service operations.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the authenticated user's profile (with roles + permissions).
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: BigInt(userId), deletedAt: null },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
        wallet: true,
      },
    });
    if (!user) throw new NotFoundException('کاربر یافت نشد');

    return {
      id: user.id.toString(),
      uuid: user.uuid,
      phone: user.phone,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      phoneVerifiedAt: user.phoneVerifiedAt,
      emailVerifiedAt: user.emailVerifiedAt,
      status: user.status,
      preferredLocale: user.preferredLocale,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      roles: user.roles.map((ur) => ur.role.name),
      permissions: Array.from(
        new Set(
          user.roles.flatMap((ur) =>
            ur.role.permissions.map((rp) => rp.permission.slug),
          ),
        ),
      ),
      wallet: user.wallet
        ? {
            id: user.wallet.id.toString(),
            balance: user.wallet.balance.toString(),
            currency: user.wallet.currency,
            status: user.wallet.status,
          }
        : null,
    };
  }

  /**
   * Update profile (self-service — only the user can edit their own profile).
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(userId) } });
    if (!user) throw new NotFoundException('کاربر یافت نشد');

    // If email is changing, mark as unverified
    const emailChanged = dto.email && dto.email !== user.email;

    const updated = await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: {
        fullName: dto.fullName,
        email: dto.email,
        preferredContactMethodId: dto.preferredContactMethodId
          ? BigInt(dto.preferredContactMethodId)
          : undefined,
        emailVerifiedAt: emailChanged ? null : undefined,
      },
    });

    this.logger.log(`User ${userId} updated profile`);
    return {
      id: updated.id.toString(),
      uuid: updated.uuid,
      phone: updated.phone,
      email: updated.email,
      fullName: updated.fullName,
      emailVerifiedAt: updated.emailVerifiedAt,
    };
  }
}
