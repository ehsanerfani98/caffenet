import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../database/prisma.service';
import { OtpService } from './otp.service';
import {
  AuthTokensResponse,
  ChangePasswordDto,
  ForgotPasswordDto,
  JwtPayload,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
  ResendOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import {
  AUTH_CONFIG,
  OtpType,
  UserStatus,
  UserRole as UserRoleEnum,
} from '@caffenet/shared';
import { maskPhone } from '../../common/utils/generators';
import { EventBusService } from '../../events/event-bus.service';

/**
 * Auth service — handles registration, login, OTP verification, token refresh, logout.
 *
 * Token strategy:
 *  - Access token: HS256, 15min TTL, in-memory or localStorage on client
 *  - Refresh token: HS256, 7d TTL, rotating (each refresh → new refresh token + old revoked)
 *  - Refresh tokens stored hashed (argon2) in sessions table
 *
 * Security:
 *  - Refresh token reuse detection (if a revoked refresh is presented, all sessions revoked)
 *  - All sensitive ops audit-logged
 *  - Passwords hashed with argon2id
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly otp: OtpService,
    private readonly events: EventBusService,
  ) {}

  /**
   * Register a new user. Creates the user with status=pending_otp, sends OTP via SMS.
   */
  async register(dto: RegisterDto): Promise<{ userId: string; otpId: string; expiresAt: Date }> {
    // Check if phone already registered & active
    const existing = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (existing && existing.status === UserStatus.ACTIVE) {
      throw new ConflictException('این شماره موبایل قبلاً ثبت شده است — وارد شوید');
    }
    if (existing && existing.status === UserStatus.PENDING_OTP) {
      // Replace pending user's password + send new OTP
      const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          email: dto.email ?? existing.email,
          fullName: dto.fullName ?? existing.fullName,
        },
      });
      const otpResult = await this.otp.send(existing.id.toString(), dto.phone, OtpType.REGISTER);
      return { userId: existing.id.toString(), otpId: otpResult.otpId, expiresAt: otpResult.expiresAt };
    }

    // Create new user with status=pending_otp
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        status: UserStatus.PENDING_OTP,
      },
    });

    // Assign default 'customer' role
    const customerRole = await this.prisma.role.findUnique({ where: { name: UserRoleEnum.CUSTOMER } });
    if (customerRole) {
      await this.prisma.userRole.create({
        data: { userId: user.id, roleId: customerRole.id },
      });
    }

    // Create wallet for customer
    await this.prisma.wallet.create({
      data: { userId: user.id, balance: 0, currency: 'IRT', status: 'active' },
    });

    // Send OTP
    const otpResult = await this.otp.send(user.id.toString(), dto.phone, OtpType.REGISTER);
    this.logger.log(`User registered: ${maskPhone(dto.phone)} — pending OTP`);

    return {
      userId: user.id.toString(),
      otpId: otpResult.otpId,
      expiresAt: otpResult.expiresAt,
    };
  }

  /**
   * Login with phone/email + password. Returns tokens ONLY if user is active.
   * If user is pending_otp, returns "otp required" instead.
   */
  async login(dto: LoginDto, context: { ip?: string; userAgent?: string }): Promise<
    | AuthTokensResponse
    | { requiresOtp: true; userId: string; otpId: string; expiresAt: Date }
  > {
    const user = await this.findUserByIdentifier(dto.identifier);
    if (!user) {
      // Don't leak which (phone/email) is registered — same error for both
      throw new UnauthorizedException('شناسه یا رمز عبور اشتباه است');
    }

    // Verify password
    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException('شناسه یا رمز عبور اشتباه است');
    }

    if (user.status === UserStatus.PENDING_OTP) {
      // Need OTP verification before login
      const otpResult = await this.otp.send(user.id.toString(), user.phone, OtpType.LOGIN);
      return {
        requiresOtp: true,
        userId: user.id.toString(),
        otpId: otpResult.otpId,
        expiresAt: otpResult.expiresAt,
      };
    }

    if (user.status === UserStatus.BANNED) {
      throw new UnauthorizedException('حساب کاربری شما مسدود شده است');
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('حساب کاربری شما به‌طور موقت غیرفعال شده است');
    }

    return this.issueTokens(user.id.toString(), context);
  }

  /**
   * Verify OTP and complete registration OR enable login.
   * On success, activates the user + issues tokens.
   */
  async verifyOtp(dto: VerifyOtpDto, context: { ip?: string; userAgent?: string }): Promise<AuthTokensResponse> {
    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    // Verify OTP (throws if invalid)
    await this.otp.verify(user.id.toString(), dto.code, dto.type);

    // Activate user if was pending
    let wasActivated = false;
    if (user.status === UserStatus.PENDING_OTP) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          status: UserStatus.ACTIVE,
          phoneVerifiedAt: new Date(),
        },
      });
      wasActivated = true;
    }

    const tokens = await this.issueTokens(user.id.toString(), context);
    this.logger.log(`User ${dto.type} OTP verified: ${maskPhone(user.phone)}${wasActivated ? ' (activated)' : ''}`);

    // Emit audit event (AuditEventListener will pick it up)
    await this.events.emit('auth.login.success', {
      userId: user.id.toString(),
      userUuid: user.uuid,
      ip: context.ip,
      userAgent: context.userAgent,
      method: 'otp' as const,
    });

    return tokens;
  }

  /**
   * Resend OTP (rate-limited inside OtpService).
   */
  async resendOtp(dto: ResendOtpDto): Promise<{ otpId: string; expiresAt: Date }> {
    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }
    const otpResult = await this.otp.send(user.id.toString(), dto.phone, dto.type);
    return { otpId: otpResult.otpId, expiresAt: otpResult.expiresAt };
  }

  /**
   * Refresh access token using refresh token.
   * Rotates: old refresh is revoked, new refresh is issued.
   * Detects reuse: if a revoked refresh is presented, ALL sessions for that user are revoked.
   */
  async refresh(dto: RefreshTokenDto, context: { ip?: string; userAgent?: string }): Promise<AuthTokensResponse> {
    // Verify JWT signature
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync(dto.refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('توکن بازیابی نامعتبر است');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('توکن بازیابی نامعتبر است');
    }

    // Hash the presented refresh token to look it up
    const tokenHash = await argon2.hash(dto.refreshToken, { type: argon2.argon2id });

    // Find session by user_id (we don't store the raw token anywhere)
    const userId = BigInt(payload.sub);
    const sessions = await this.prisma.session.findMany({
      where: { userId, status: 'active', expiresAt: { gt: new Date() } },
    });

    // Find the matching session (compare hashes)
    let session: typeof sessions[0] | undefined;
    for (const s of sessions) {
      if (await argon2.verify(s.refreshTokenHash, dto.refreshToken)) {
        session = s;
        break;
      }
    }

    if (!session) {
      // Refresh token doesn't match any active session.
      // POTENTIAL TOKEN THEFT — revoke all sessions for this user (defense in depth)
      this.logger.warn(`⚠️ Refresh token reuse detected for user ${payload.sub} — revoking all sessions`);
      await this.prisma.session.updateMany({
        where: { userId, status: 'active' },
        data: { status: 'revoked', revokedAt: new Date() },
      });
      throw new UnauthorizedException('توکن بازیابی نامعتبر است — لطفاً دوباره وارد شوید');
    }

    // Rotate: revoke old session + create new
    await this.prisma.session.update({
      where: { id: session.id },
      data: { status: 'revoked', revokedAt: new Date() },
    });

    return this.issueTokens(userId.toString(), context);
  }

  /**
   * Logout: revoke the session for the given refresh token.
   */
  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
      const userId = BigInt(payload.sub);
      const sessions = await this.prisma.session.findMany({
        where: { userId, status: 'active' },
      });
      for (const s of sessions) {
        if (await argon2.verify(s.refreshTokenHash, refreshToken)) {
          await this.prisma.session.update({
            where: { id: s.id },
            data: { status: 'revoked', revokedAt: new Date() },
          });
          break;
        }
      }
    } catch {
      // Silent — logout is idempotent
    }
  }

  /**
   * Forgot password: send OTP for reset.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ otpId?: string; expiresAt?: Date; message: string }> {
    const user = await this.findUserByIdentifier(dto.identifier);
    if (!user) {
      // Don't leak whether user exists — return generic success
      return { message: 'اگر شناسه معتبر باشد، کد تأیید برایتان ارسال شد' };
    }
    const otpResult = await this.otp.send(user.id.toString(), user.phone, OtpType.FORGOT_PASSWORD);
    return {
      otpId: otpResult.otpId,
      expiresAt: otpResult.expiresAt,
      message: 'کد تأیید برایتان ارسال شد',
    };
  }

  /**
   * Reset password using OTP code.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }
    await this.otp.verify(user.id.toString(), dto.code, OtpType.FORGOT_PASSWORD);
    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    // Revoke all sessions (force re-login)
    await this.prisma.session.updateMany({
      where: { userId: user.id, status: 'active' },
      data: { status: 'revoked', revokedAt: new Date() },
    });
    this.logger.log(`Password reset for ${maskPhone(user.phone)}`);
    await this.events.emit('auth.password.reset', {
      userId: user.id.toString(),
      userUuid: user.uuid,
    });
    return { message: 'رمز عبور با موفقیت تغییر یافت — لطفاً دوباره وارد شوید' };
  }

  /**
   * Change password (authenticated user, with current password verification).
   */
  async changePassword(userId: string, dto: ChangePasswordDto, context?: { ip?: string }): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(userId) } });
    if (!user) throw new NotFoundException('کاربر یافت نشد');

    const currentValid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!currentValid) {
      throw new UnauthorizedException('رمز عبور فعلی اشتباه است');
    }
    const passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    await this.events.emit('auth.password.changed', {
      userId: user.id.toString(),
      userUuid: user.uuid,
      ip: context?.ip,
    });
    return { message: 'رمز عبور با موفقیت تغییر یافت' };
  }

  // ==================== INTERNAL HELPERS ====================

  /**
   * Issue access + refresh tokens for a user, creating a new session.
   */
  async issueTokens(userId: string, context: { ip?: string; userAgent?: string }): Promise<AuthTokensResponse> {
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
      },
    });
    if (!user) throw new NotFoundException('کاربر یافت نشد');

    const roles = user.roles.map((ur) => ur.role.name);
    const permissions = Array.from(
      new Set(
        user.roles.flatMap((ur) =>
          ur.role.permissions.map((rp) => rp.permission.slug),
        ),
      ),
    );

    const accessPayload: JwtPayload = {
      sub: user.id.toString(),
      uuid: user.uuid,
      phone: user.phone,
      roles,
      type: 'access',
    };

    const refreshPayload: JwtPayload = {
      ...accessPayload,
      type: 'refresh',
    };

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m'),
    });

    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_TTL', '7d'),
    });

    // Store session with hashed refresh token
    const refreshHash = await argon2.hash(refreshToken, { type: argon2.argon2id });
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + AUTH_CONFIG.REFRESH_TOKEN_TTL_SECONDS * 1000);
    await this.prisma.session.create({
      data: {
        uuid: sessionId,
        userId: user.id,
        refreshTokenHash: refreshHash,
        userAgent: context.userAgent,
        ip: context.ip,
        expiresAt,
        status: 'active',
      },
    });

    // Update last login info
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: context.ip,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: AUTH_CONFIG.ACCESS_TOKEN_TTL_SECONDS,
      user: {
        id: user.id.toString(),
        uuid: user.uuid,
        phone: user.phone,
        email: user.email,
        fullName: user.fullName,
        roles,
        permissions,
        status: user.status,
      },
    };
  }

  private async findUserByIdentifier(identifier: string) {
    // Identifier is phone or email
    const isEmail = identifier.includes('@');
    if (isEmail) {
      return this.prisma.user.findUnique({ where: { email: identifier } });
    }
    // Otherwise treat as phone
    return this.prisma.user.findUnique({ where: { phone: identifier } });
  }
}
