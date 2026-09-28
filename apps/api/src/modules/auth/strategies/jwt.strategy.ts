import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../dto/auth.dto';
import { PrismaService } from '../../database/prisma.service';

/**
 * JWT strategy for authenticating users via access tokens.
 *
 * Validates the JWT signature (HS256 — symmetric) and checks that the
 * user still exists and is active.
 *
 * The payload.sub is the user's BigInt id as string (JWT spec doesn't allow BigInt).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET')!,
      // Tokens issued after key rotation will be rejected
    });
  }

  /**
   * Called automatically by Passport after signature is verified.
   * Returns the user object that becomes request.user.
   */
  async validate(payload: JwtPayload) {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('توکن دسترسی نامعتبر است');
    }

    const userId = BigInt(payload.sub);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
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
      },
    });

    if (!user) {
      throw new UnauthorizedException('کاربر یافت نشد');
    }
    if (user.status === 'banned') {
      throw new UnauthorizedException('حساب کاربری شما مسدود شده است');
    }
    if (user.status === 'suspended') {
      throw new UnauthorizedException('حساب کاربری شما به‌طور موقت غیرفعال شده است');
    }

    // Flatten roles & permissions
    const roles = user.roles.map((ur) => ur.role.name);
    const permissions = Array.from(
      new Set(
        user.roles.flatMap((ur) =>
          ur.role.permissions.map((rp) => rp.permission.slug),
        ),
      ),
    );

    return {
      id: user.id.toString(),
      uuid: user.uuid,
      phone: user.phone,
      email: user.email,
      fullName: user.fullName,
      roles,
      permissions,
      status: user.status,
    };
  }
}
