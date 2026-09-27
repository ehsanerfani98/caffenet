/**
 * Caffenet Worker CLI — processes queued jobs.
 *
 * Shared hosting deployment:
 *   Runs via cron every minute: `node dist/worker.js --max-jobs=50 --timeout=55`
 *   Self-terminates after maxJobs or timeoutSeconds.
 *
 * VPS deployment:
 *   Runs via PM2 as a long-lived daemon: `pm2 start ecosystem.config.cjs --only caffenet-api-worker`
 *
 * Job processing:
 * 1. Reserve next job (atomic, SKIP LOCKED)
 * 2. Look up handler by JobName
 * 3. Execute handler with payload
 * 4. Mark job complete() or fail()
 * 5. Repeat until maxJobs reached OR timeout exceeded OR queue empty
 */

import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { QUEUE_TOKEN } from './queue/interfaces/queue.interface';
import { DeploymentProfileService } from './config/deployment-profile.service';

interface WorkerArgs {
  maxJobs: number;
  timeoutSeconds: number;
  queueName: string;
  once: boolean;
}

function parseArgs(): WorkerArgs {
  const args = process.argv.slice(2);
  const result: WorkerArgs = {
    maxJobs: 50,
    timeoutSeconds: 55,
    queueName: 'caffenet-jobs',
    once: false,
  };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--max-jobs':
        result.maxJobs = parseInt(args[++i]!, 10);
        break;
      case '--timeout':
        result.timeoutSeconds = parseInt(args[++i]!, 10);
        break;
      case '--queue':
        result.queueName = args[++i]!;
        break;
      case '--once':
        result.once = true;
        break;
    }
  }
  return result;
}

async function bootstrap() {
  const startedAt = Date.now();
  const logger = new Logger('Worker');
  const args = parseArgs();

  logger.log(`🚀 Worker starting — maxJobs=${args.maxJobs}, timeout=${args.timeoutSeconds}s, queue=${args.queueName}`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const queue = app.get(QUEUE_TOKEN);
    const profile = app.get(DeploymentProfileService);
    logger.log(`Profile: ${profile.profile}, queue driver: ${profile.queueDriver}`);

    const reservationSeconds = args.timeoutSeconds + 30; // buffer for safety
    const startTime = Date.now();
    let processed = 0;
    let failed = 0;

    while (processed < args.maxJobs) {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed >= args.timeoutSeconds) {
        logger.log(`⏱️ Timeout reached (${elapsed.toFixed(1)}s), exiting`);
        break;
      }

      const job = await queue.reserveNext(args.queueName, reservationSeconds);
      if (!job) {
        if (args.once) {
          logger.log('📭 No jobs in queue, --once mode, exiting');
          break;
        }
        // Wait 1 second before polling again (reduces DB load)
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      try {
        logger.log(`▶️ Processing job ${job.uuid} (name=${job.name}, attempt=${job.attempts}/${job.maxAttempts})`);
        // TODO Phase 11: dispatch to actual job handler by JobName
        // For Phase 1, we just log and mark complete.
        logger.log(`✅ Job ${job.uuid} processed (stub)`);
        await queue.complete(job.id);
        processed++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error(`❌ Job ${job.uuid} failed: ${errorMsg}`);
        await queue.fail(job.id, errorMsg);
        failed++;
      }
    }

    const totalElapsed = ((Date.now() - startedAt) / 1000).toFixed(2);
    logger.log(`🏁 Worker done — processed=${processed}, failed=${failed}, elapsed=${totalElapsed}s`);
  } catch (err) {
    logger.error(`Fatal worker error: ${err instanceof Error ? err.message : String(err)}`, err instanceof Error ? err.stack : undefined);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

bootstrap().catch((err) => {
  console.error('Fatal worker bootstrap error', err);
  process.exit(1);
});
