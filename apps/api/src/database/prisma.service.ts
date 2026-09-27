import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma client wrapper for NestJS.
 *
 * Uses `BigInt` for IDs (mapped to BIGINT in MySQL).
 * On the frontend, BigInts are serialized as strings via custom serialization.
 *
 * Important: For all financial operations, use $transaction with
 * `isolationLevel: 'Serializable'` and `SELECT ... FOR UPDATE`.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'info', emit: 'event' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ Prisma connected to database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('🔌 Prisma disconnected');
  }
}
