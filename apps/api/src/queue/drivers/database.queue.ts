import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { IQueue, IJobPayload, QueueStats, ReservedJob } from '../interfaces/queue.interface';
import { JobName, JobStatus } from '@caffenet/shared';

/**
 * Database-backed queue driver — for shared hosting profile.
 *
 * How it works:
 * 1. enqueue(): INSERT a row in `jobs` table with status='pending'.
 * 2. reserveNext(): ATOMIC UPDATE — `UPDATE jobs SET status='reserved', reserved_at=NOW()
 *    WHERE id = (SELECT id FROM jobs WHERE status='pending' AND available_at <= NOW()
 *    ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED) LIMIT 1`
 *    The SKIP LOCKED ensures no two workers reserve the same job.
 * 3. complete()/fail(): UPDATE status.
 *
 * The worker CLI calls reserveNext() in a loop until it has processed MAX_JOBS
 * jobs or the TIMEOUT is reached, then exits (so cron can re-launch it).
 */
@Injectable()
export class DatabaseQueue implements IQueue {
  private readonly logger = new Logger(DatabaseQueue.name);

  constructor(private readonly prisma: PrismaService) {}

  async enqueue<K extends JobName>(
    name: K,
    payload: IJobPayload[K],
    options?: { delaySeconds?: number; idempotencyKey?: string; maxAttempts?: number },
  ): Promise<string> {
    const uuid = uuidv4();
    const availableAt = options?.delaySeconds
      ? new Date(Date.now() + options.delaySeconds * 1000)
      : new Date();

    // Idempotency check — if idempotencyKey is provided, don't insert a duplicate
    if (options?.idempotencyKey) {
      const existing = await this.prisma.job.findFirst({
        where: { idempotencyKey: options.idempotencyKey },
      });
      if (existing) {
        this.logger.debug(
          `Job already enqueued with idempotency key ${options.idempotencyKey}, returning existing`,
        );
        return existing.uuid;
      }
    }

    const job = await this.prisma.job.create({
      data: {
        uuid,
        queue: 'caffenet-jobs',
        name,
        payload: payload as object,
        status: JobStatus.PENDING,
        maxAttempts: options?.maxAttempts ?? 3,
        availableAt,
        idempotencyKey: options?.idempotencyKey,
      },
    });
    return job.uuid;
  }

  async reserveNext(queueName: string, reservationSeconds: number): Promise<ReservedJob | null> {
    // Atomic reservation using SKIP LOCKED (MySQL 8+)
    // This prevents multiple workers from picking up the same job.
    const reservedUntil = new Date(Date.now() + reservationSeconds * 1000);

    const result = await this.prisma.$queryRaw<
      Array<{
        id: bigint;
        uuid: string;
        name: string;
        payload: unknown;
        attempts: number;
        maxAttempts: number;
      }>
    >`
      WITH next_job AS (
        SELECT id FROM jobs
        WHERE queue = ${queueName}
          AND status = 'pending'
          AND available_at <= NOW()
        ORDER BY id ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE jobs
      SET status = 'reserved',
          reserved_at = NOW(),
          attempts = attempts + 1
      WHERE id IN (SELECT id FROM next_job)
      RETURNING id, uuid, name, payload, attempts, max_attempts as maxAttempts
    `;

    if (!result || result.length === 0) {
      return null;
    }

    const job = result[0];
    if (!job) return null;
    if (job.attempts > job.maxAttempts) {
      // Exceeded retries — mark failed
      await this.prisma.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.FAILED,
          failedAt: new Date(),
          errorMessage: 'Max attempts exceeded',
        },
      });
      this.logger.warn(`Job ${job.uuid} exceeded max attempts, marked failed`);
      return null;
    }

    return {
      id: job.id.toString(),
      uuid: job.uuid,
      name: job.name as JobName,
      payload: job.payload,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
    };
  }

  async complete(jobId: string): Promise<void> {
    await this.prisma.job.update({
      where: { id: BigInt(jobId) },
      data: {
        status: JobStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
  }

  async fail(jobId: string, error: string): Promise<void> {
    const job = await this.prisma.job.findUnique({ where: { id: BigInt(jobId) } });
    if (!job) return;

    if (job.attempts >= job.maxAttempts) {
      await this.prisma.job.update({
        where: { id: BigInt(jobId) },
        data: {
          status: JobStatus.FAILED,
          failedAt: new Date(),
          lastError: error,
          reservedAt: null,
        },
      });
    } else {
      // Re-queue for next attempt
      await this.prisma.job.update({
        where: { id: BigInt(jobId) },
        data: {
          status: JobStatus.PENDING,
          lastError: error,
          reservedAt: null,
          availableAt: new Date(Date.now() + 60_000), // retry after 1 min
        },
      });
    }
  }

  async stats(queueName: string): Promise<QueueStats> {
    const [pending, reserved, failed, completedToday] = await Promise.all([
      this.prisma.job.count({ where: { queue: queueName, status: JobStatus.PENDING } }),
      this.prisma.job.count({ where: { queue: queueName, status: JobStatus.RESERVED } }),
      this.prisma.job.count({ where: { queue: queueName, status: JobStatus.FAILED } }),
      this.prisma.job.count({
        where: {
          queue: queueName,
          status: JobStatus.COMPLETED,
          completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);

    return { pending, reserved, failed, completedToday };
  }
}
