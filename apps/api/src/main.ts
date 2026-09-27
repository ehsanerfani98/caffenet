import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { json, urlencoded } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3001);
  const env = config.get<string>('NODE_ENV', 'development');
  const corsOrigins = config.get<string>('CORS_ORIGINS', 'http://localhost:3000').split(',');

  // Pino logger
  app.useLogger(app.get(PinoLogger));

  // Security
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser(config.get<string>('COOKIE_SECRET')));
  app.use(compression());
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // CORS — strict whitelist
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
  });

  // Global prefix
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  // Validation pipe (global, whitelist + forbid non-whitelisted)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      stopAtFirstError: false,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());
  // Request ID + logging
  app.useGlobalInterceptors(new RequestIdInterceptor());

  // Swagger (only in non-production)
  if (env !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Caffenet API')
      .setDescription('Production-Ready Internet Cafe Service Platform')
      .setVersion('1.0.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .addTag('auth', 'Authentication & OTP')
      .addTag('users', 'User management')
      .addTag('categories', 'Service categories')
      .addTag('services', 'Service catalog')
      .addTag('requests', 'Customer requests')
      .addTag('wallet', 'Wallet operations')
      .addTag('payments', 'Online payments')
      .addTag('invoices', 'Invoices')
      .addTag('discounts', 'Discount codes')
      .addTag('chat', 'Real-time chat')
      .addTag('notifications', 'In-app & push notifications')
      .addTag('admin', 'Admin operations')
      .addTag('broadcasting', 'Real-time channel auth')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  // Shutdown hooks (graceful)
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Caffenet API running on port ${port} [${env}]`);
  logger.log(`📚 API docs at /api/docs (non-prod only)`);
  logger.log(`💊 Health check at /health`);
}

bootstrap().catch((err) => {
  console.error('❌ Failed to bootstrap API', err);
  process.exit(1);
});
