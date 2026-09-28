# Architecture Decision Records (ADR)

This directory documents significant architectural decisions made during the Caffenet project.

## ADR Index

- [ADR-0001: Dual Deployment Profile (Shared Hosting + VPS)](./0001-dual-deployment-profile.md) — 2026-09-28
- [ADR-0002: MySQL 8 as primary database](./0002-mysql-primary-database.md) — 2026-09-28
- [ADR-0003: Pusher.com cloud for real-time (no Soketi)](./0003-pusher-cloud-realtime.md) — 2026-09-28
- [ADR-0004: Database-backed queue with SKIP LOCKED](./0004-database-queue.md) — 2026-09-28
- [ADR-0005: iPanel SMS with pattern-based OTP](./0005-ipanel-sms.md) — 2026-09-28
- [ADR-0006: All money stored as BIGINT minor units](./0006-money-as-bigint.md) — 2026-09-28
- [ADR-0007: Shared Hosting Profile does NOT use Docker](./0007-shared-hosting-no-docker.md) — 2026-09-28

## Format

Each ADR follows the [Michael Nygard template](https://github.com/joelparkerhenderson/architecture-decision-record):
- Title
- Status (Proposed, Accepted, Deprecated, Superseded)
- Context
- Decision
- Consequences
- Notes

## When to write an ADR

Write an ADR when you make a decision that:
- Affects multiple modules
- Has trade-offs that future developers need to understand
- Reverses a previous decision
- Is non-obvious from the code alone

Do **not** write an ADR for:
- Trivial implementation choices (variable names, helper function placement)
- Bug fixes
- Dependency upgrades

## How to write an ADR

1. Copy `0000-template.md` to a new file with the next available number
2. Fill in the template
3. Link the new ADR in the index above
4. Commit with message: `docs(adr): ADR-000X — <short title>`
