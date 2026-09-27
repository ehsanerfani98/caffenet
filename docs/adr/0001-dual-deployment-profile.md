# ADR-0001: Dual Deployment Profile (Shared Hosting + VPS)

- **Status**: Accepted
- **Date**: 2026-09-28
- **Decision Maker**: Architect
- **Stakeholder Confirmation**: Yes (2026-09-28)

## Context

The original architecture proposed VPS-only deployment with Docker, Redis, PostgreSQL, MinIO, and Soketi. The stakeholder requested that the system also work on **shared hosting** (cPanel, DirectAdmin, LiteSpeed hosts common in Iran), because:

1. Shared hosting is significantly cheaper ($5/month vs $20+/month for VPS).
2. Many small internet cafes already have shared hosting.
3. Operational overhead is lower (no server management required).

Shared hosting has these constraints:
- No Docker
- No Redis (usually)
- No PostgreSQL (usually — only MySQL/MariaDB)
- No WebSocket servers (only ports 80/443)
- No long-running processes (stateless request-response model)
- Cron limited to every 1 minute minimum
- Memory limit ~256-512MB
- Limited SSH access

## Decision

Implement a **dual deployment profile** with environment-variable-driven driver selection for every infrastructure component:

| Component | Shared Profile | VPS Profile |
|-----------|----------------|-------------|
| Cache | File-based | Redis |
| Queue | Database table with `SKIP LOCKED` | BullMQ + Redis |
| Real-Time | Pusher.com (cloud, external) | Pusher.com (or Soketi) |
| Storage | Local filesystem | MinIO/S3 |
| Worker | Cron every minute, self-terminating | PM2 daemon |
| Database | MySQL 8 | MySQL 8 or PostgreSQL |

The system uses three abstraction layers (Cache, Queue, Storage) with swappable drivers selected by env vars:
- `CACHE_DRIVER=file|redis`
- `QUEUE_DRIVER=database|redis`
- `STORAGE_DRIVER=local|s3`
- `DEPLOYMENT_PROFILE=shared|vps` (master switch)

## Consequences

### Positive
- ✅ Same codebase works on both shared and VPS
- ✅ Easy migration from shared → VPS as traffic grows
- ✅ Stakeholder's primary requirement satisfied
- ✅ Lower operational cost for early stage
- ✅ No vendor lock-in (drivers are pluggable)

### Negative
- ⚠️ File-based cache is slower than Redis — affects high-frequency cache hits
- ⚠️ Database-backed queue has higher latency than BullMQ (cron minute-resolution)
- ⚠️ Background job processing has 1-minute minimum delay on shared hosting
- ⚠️ Some abstractions add a thin layer of indirection
- ⚠️ Local storage doesn't support presigned URLs (uses backend-streamed downloads)

### Mitigations
- File cache only used for low-volume, slow-changing data (settings, permission lists)
- Cron worker processes up to 50 jobs/minute — sufficient for typical launch volume
- Pusher.com removes need for WebSocket server, simplifying shared hosting compat
- Backend-streamed downloads are actually more secure (always auth-checked)

## Notes

- This decision was made after stakeholder confirmation on 2026-09-28.
- The first production deployment will use the **Shared Hosting Profile** (per stakeholder directive).
- VPS profile is documented but not the initial deployment target.
- When migrating to VPS, simply change env vars — no code changes needed.

## References

- Original architecture proposal: Phase 0 (2026-09-28)
- Stakeholder feedback: "برنامه باید طوری نوشته شود که بتوان در هاست های اشتراکی هم استفاده کرد"
- See also: ADR-0002 (MySQL), ADR-0003 (Pusher), ADR-0004 (Database Queue)
