import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';
import { OtpType } from '@caffenet/shared';

export class RegisterDto {
  @ApiProperty({ example: '09123456789', description: 'شماره موبایل (ایرانی)' })
  @Matches(/^09\d{9}$/, { message: 'فرمت تلفن نامعتبر است — باید 09xxxxxxxxx باشد' })
  phone!: string;

  @ApiProperty({ example: 'secret123', description: 'رمز عبور (حداقل ۸ کاراکتر)' })
  @IsString()
  @MinLength(8, { message: 'رمز عبور باید حداقل ۸ کاراکتر باشد' })
  password!: string;

  @ApiPropertyOptional({ example: 'ali@example.com' })
  @IsOptional()
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'فرمت ایمیل نامعتبر است' })
  email?: string;

  @ApiPropertyOptional({ example: 'علی رضایی' })
  @IsOptional()
  @IsString()
  @Length(2, 255)
  fullName?: string;
}

export class LoginDto {
  @ApiProperty({ example: '09123456789', description: 'تلفن یا ایمیل' })
  @IsString()
  @MinLength(5)
  identifier!: string; // phone or email

  @ApiProperty({ example: 'secret123' })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '09123456789' })
  @Matches(/^09\d{9}$/, { message: 'فرمت تلفن نامعتبر است' })
  phone!: string;

  @ApiProperty({ example: '123456', description: 'کد ۶ رقمی پیامک‌شده' })
  @IsString()
  @Length(6, 6, { message: 'کد تأیید باید ۶ رقم باشد' })
  code!: string;

  @ApiProperty({ enum: OtpType, default: OtpType.REGISTER })
  @IsEnum(OtpType)
  type!: OtpType;
}

export class ResendOtpDto {
  @ApiProperty({ example: '09123456789' })
  @Matches(/^09\d{9}$/, { message: 'فرمت تلفن نامعتبر است' })
  phone!: string;

  @ApiProperty({ enum: OtpType })
  @IsEnum(OtpType)
  type!: OtpType;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token' })
  @IsString()
  @MinLength(32)
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: '09123456789', description: 'تلفن یا ایمیل' })
  @IsString()
  @MinLength(5)
  identifier!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: '09123456789' })
  @Matches(/^09\d{9}$/, { message: 'فرمت تلفن نامعتبر است' })
  phone!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiProperty({ example: 'newpassword123' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'oldpassword' })
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @ApiProperty({ example: 'newpassword' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export interface JwtPayload {
  sub: string; // user id (BigInt as string for JWT)
  uuid: string;
  phone: string;
  roles: string[];
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  /** Access token TTL in seconds */
  expiresIn: number;
  user: {
    id: string;
    uuid: string;
    phone: string;
    email: string | null;
    fullName: string | null;
    roles: string[];
    permissions: string[];
    status: string;
  };
}
