import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SmsModule } from '../sms/sms.module';
import { EventsModule } from '../../events/events.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // Note: AuthService uses ConfigService directly to read JWT secrets at runtime,
    // so JwtModule.registerAsync here is only for any direct JwtService usage.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_ACCESS_TTL', '15m') },
      }),
    }),
    SmsModule,
    EventsModule,
  ],
  controllers: [AuthController, SessionController],
  providers: [AuthService, OtpService, SessionService, JwtStrategy, JwtAuthGuard],
  exports: [AuthService, SessionService, JwtAuthGuard, JwtModule, PassportModule],
})
export class AuthModule {}
