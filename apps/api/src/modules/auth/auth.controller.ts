import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResendOtpDto,
  ResetPasswordDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @Throttle({ auth: { limit: 3, ttl: 60 * 60 * 1000 } }) // 3/hour per IP
  @ApiOperation({ summary: 'ثبت‌نام — شماره موبایل و رمز عبور' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const result = await this.auth.register(dto);
    return {
      userId: result.userId,
      otpId: result.otpId,
      expiresAt: result.expiresAt,
      message: 'کد تأیید برایتان ارسال شد',
    };
  }

  @Public()
  @Post('login')
  @Throttle({ auth: { limit: 5, ttl: 60 * 1000 } }) // 5/min per IP
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ورود — تلفن/ایمیل + رمز عبور' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const context = this.getContext(req);
    const result = await this.auth.login(dto, context);
    if ('requiresOtp' in result) {
      return {
        requiresOtp: true,
        userId: result.userId,
        otpId: result.otpId,
        expiresAt: result.expiresAt,
        message: 'برای تکمیل ورود، کد تأیید ارسال‌شده به موبایل را وارد کنید',
      };
    }
    return result;
  }

  @Public()
  @Post('verify-otp')
  @Throttle({ otp: { limit: 10, ttl: 60 * 1000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تأیید کد OTP' })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    const context = this.getContext(req);
    return this.auth.verifyOtp(dto, context);
  }

  @Public()
  @Post('resend-otp')
  @Throttle({ otp: { limit: 3, ttl: 60 * 60 * 1000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ارسال مجدد کد OTP' })
  async resendOtp(@Body() dto: ResendOtpDto) {
    const result = await this.auth.resendOtp(dto);
    return {
      otpId: result.otpId,
      expiresAt: result.expiresAt,
      message: 'کد جدید برایتان ارسال شد',
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تمدید توکن دسترسی با توکن بازیابی' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.auth.refresh(dto, this.getContext(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'خروج — باطل کردن session فعلی' })
  async logout(@Body() body: { refreshToken?: string }) {
    if (body.refreshToken) {
      await this.auth.logout(body.refreshToken);
    }
    return { message: 'خروج با موفقیت انجام شد' };
  }

  @Public()
  @Post('forgot-password')
  @Throttle({ auth: { limit: 3, ttl: 60 * 60 * 1000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'بازیابی رمز عبور — ارسال کد تأیید' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @Throttle({ otp: { limit: 5, ttl: 60 * 60 * 1000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'بازنشانی رمز عبور با کد تأیید' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تغییر رمز عبور (کاربر واردشده)' })
  async changePassword(
    @CurrentUser() user: { id: string },
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    return this.auth.changePassword(user.id, dto, this.getContext(req));
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'اطلاعات کاربر واردشده' })
  async me(@CurrentUser() user: unknown) {
    return user;
  }

  private getContext(req: Request) {
    const forwardedFor = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor || req.socket.remoteAddress;
    return {
      ip,
      userAgent: req.headers['user-agent'],
    };
  }
}
