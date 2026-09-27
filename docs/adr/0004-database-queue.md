# ADR-0004: Database-Backed Queue with SKIP LOCKED

- **Status**: Accepted
- **Date**: 2026-09-28

## Context

For shared hosting, we cannot run long-running queue worker processes (BullMQ + Redis). Background jobs (notifications, web push, email, SMS, payment reconciliation) must still be processed.

Shared hosting allows **cron jobs** (minimum every 1 minute). So we need:
1. A queue storage mechanism that doesn't require Redis
2. A worker CLI that can be invoked by cron, processes jobs, then exits

## Decision

Implement a **database-backed queue** using the MySQL `jobs` table.

### Schema

The `jobs` table (see `apps/api/prisma/schema.prisma`) has columns:
- `id`, `uuid` — identification
- `queue`, `name`, `payload` (JSON) — job data
- `status` (`pending`, `reserved`, `completed`, `failed`, `expired`)
- `attempts`, `max_attempts` — retry tracking
- `available_at`, `reserved_at`, `completed_at`, `failed_at` — lifecycle timestamps
- `last_error`, `error_message` — diagnostics
- `idempotency_key` (UNIQUE) — for safe retries

### Atomic Job Reservation (Critical)

The `reserveNext` method uses an atomic UPDATE with `SELECT ... FOR UPDATE SKIP LOCKED`:

```sql
WITH next_job AS (
  SELECT id FROM jobs
  WHERE queue = 'caffenet-jobs'
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
RETURNING id, uuid, name, payload, attempts, max_attempts;
```

The `SKIP LOCKED` clause ensures that **multiple workers** (e.g., on VPS or with overlapping cron runs) **never reserve the same job**.

### Worker CLI

`apps/api/src/worker.ts`:
- Runs via cron every minute
- Accepts `--max-jobs` (default 50) and `--timeout` (default 55s) flags
- Loops: `reserveNext()` → process → `complete()` or `fail()`
- Self-terminates when:
  - maxJobs reached, OR
  - timeout exceeded, OR
  - queue empty (in `--once` mode)

### Idempotency

The `idempotency_key` column has a UNIQUE constraint. If a job with the same key already exists, `enqueue()` returns the existing job UUID instead of inserting a duplicate. This protects against double-enqueue on retry or network failure.

## Consequences

### Positive
- ✅ Works on shared hosting (no Redis required)
- ✅ Atomic job reservation (no double-processing)
- ✅ Self-terminating worker (cron-friendly)
- ✅ Idempotency prevents duplicate work
- ✅ Same `IQueue` interface as Redis/BullMQ — easy to migrate

### Negative
- ⚠️ Latency: jobs are processed at most every 1 minute (cron resolution)
- ⚠️ Higher DB load (each job = 4 queries: reserve, process, complete/fail, optional requeue)
- ⚠️ No delayed jobs natively (we use `available_at` column, but cron still polls every minute)
- ⚠️ Worker timeout (55s) limits job duration

### Mitigations
- For real-time jobs (notifications), Pusher.com handles real-time delivery; queue is for offline push/email/SMS
- Worker processes up to 50 jobs/minute — sufficient for typical launch volume
- Long-running jobs (e.g., PDF generation) should be split into smaller units
- When migrating to VPS, set `QUEUE_DRIVER=redis` to use BullMQ (faster, no polling)

## References

- ADR-0001: Dual Deployment Profile
- TASKS.md Phase 1.4.10: Queue abstraction layer
- MySQL 8 SKIP LOCKED documentation
