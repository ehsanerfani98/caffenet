import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { PrismaModule } from './database/prisma.module';
import { AppController } from './app.controller';
import { envValidation } from './config/env.validation';
import { DeploymentProfileService } from './config/deployment-profile.service';
import { RealtimeModule } from './realtime/realtime.module';
import { CacheModule } from './cache/cache.module';
import { QueueModule } from './queue/queue.module';
import { StorageModule } from './storage/storage.module';
import { EventsModule } from './events/events.module';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AuditModule } from './modules/audit/audit.module';
import { SmsModule } from './modules/sms/sms.module';
import { HealthModule } from './modules/health/health.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ServicesModule } from './modules/services/services.module';
import { FilesModule } from './modules/files/files.module';
import { RequestsModule } from './modules/requests/requests.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { DiscountsModule } from './modules/discounts/discounts.module';
import { InvoicesModule } from './modules/invoices/invoices.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidation,
      validationOptions: { allowUnknown: true, abortEarly: false },
      envFilePath: ['.env.local', '.env'],
    }),
    // Internal event bus (in-memory, single process — works on shared hosting)
    EventEmitterModule.forRoot({
      // Use wildcards for hierarchical events (e.g. 'audit.*', 'request.*')
      wildcard: true,
      // Delimiter between event segments
      delimiter: '.',
      // Don't await listeners by default (fire-and-forget)
      maxListeners: 20,
    }),
    // Structured logging
    LoggerModule.forRootAsync({
      useFactory: () => ({
        pinoHttp: {
          level: process.env.LOG_LEVEL || 'info',
          transport:
            process.env.LOG_PRETTY === 'true'
              ? {
                  target: 'pino-pretty',
                  options: { colorize: true, translateTime: 'SYS:standard' },
                }
              : undefined,
          // Redact sensitive fields from logs
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'req.body.passwordHash',
              'req.body.currentPassword',
              'req.body.newPassword',
              'req.body.code',
              'req.body.otp',
              'res.body.token',
              'res.body.accessToken',
              'res.body.refreshToken',
            ],
            censor: '[REDACTED]',
          },
        },
      }),
    }),
    // Rate limiting (uses default ThrottlerGuard via APP_GUARD)
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 },
      { name: 'auth', ttl: 60_000, limit: 5 },
      { name: 'otp', ttl: 60_000, limit: 10 },
    ]),
    // Cron (used by ScheduleModule for cleanup tasks on VPS — on shared hosting we use cron CLI)
    ScheduleModule.forRoot(),
    // Core infrastructure
    PrismaModule,
    RealtimeModule,
    CacheModule,
    QueueModule,
    StorageModule,
    EventsModule,
    AuditModule,
    DeploymentProfileService,
    // Feature modules
    HealthModule,
    SmsModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ServicesModule,
    FilesModule,
    RequestsModule,
    PricingModule,
    DiscountsModule,
    InvoicesModule,
    // Additional modules (Phase 6+) added here
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
