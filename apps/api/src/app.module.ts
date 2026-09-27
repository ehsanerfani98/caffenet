import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { PrismaModule } from './database/prisma.module';
import { AppController } from './app.controller';
import { envValidation } from './config/env.validation';
import { DeploymentProfileService } from './config/deployment-profile.service';
import { RealtimeModule } from './realtime/realtime.module';
import { CacheModule } from './cache/cache.module';
import { QueueModule } from './queue/queue.module';
import { StorageModule } from './storage/storage.module';
import { EventsModule } from './events/events.module';

// Feature modules (placeholders for now — Phase 2+ will implement them)
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidation,
      validationOptions: { allowUnknown: true, abortEarly: false },
      envFilePath: ['.env.local', '.env'],
    }),
    // Structured logging
    LoggerModule.forRootAsync({
      useFactory: () => ({
        pinoHttp: {
          level: process.env.LOG_LEVEL || 'info',
          transport:
            process.env.LOG_PRETTY === 'true'
              ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
              : undefined,
          // Redact sensitive fields
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'req.body.passwordHash',
              'req.body.code',
              'req.body.otp',
              'res.body.token',
              'res.body.refreshToken',
            ],
            censor: '[REDACTED]',
          },
        },
      }),
    }),
    // Rate limiting
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 },
      { name: 'auth', ttl: 60_000, limit: 5 },
      { name: 'otp', ttl: 60_000, limit: 10 },
    ]),
    // Cron (VPS profile only)
    ScheduleModule.forRoot(),
    // Core infrastructure
    PrismaModule,
    RealtimeModule,
    CacheModule,
    QueueModule,
    StorageModule,
    EventsModule,
    DeploymentProfileService,
    // Feature modules (placeholders)
    HealthModule,
    AuthModule,
    // Additional modules (Phase 3+) added here
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
