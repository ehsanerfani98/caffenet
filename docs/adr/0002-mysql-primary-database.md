# ADR-0002: MySQL 8 as Primary Database

- **Status**: Accepted
- **Date**: 2026-09-28

## Context

Initial proposal was PostgreSQL 16 for its superior JSONB, SERIALIZABLE isolation, and advanced indexing. However:
1. Shared hosting in Iran typically offers only MySQL/MariaDB.
2. PostgreSQL is rare and expensive on shared hosts.
3. Some operations (e.g., JSONB queries) would not be portable.

The system has strict financial safety requirements:
- Atomic transactions
- Row-level locking (`SELECT FOR UPDATE`)
- SERIALIZABLE isolation level
- UNIQUE constraints for idempotency
- CHECK constraints

## Decision

Use **MySQL 8 (InnoDB)** as the primary database for both deployment profiles. PostgreSQL remains an optional variant for VPS-only advanced deployments (not yet implemented).

### MySQL 8 Feature Verification

| Requirement | MySQL 8 Support |
|-------------|------------------|
| SERIALIZABLE isolation | ✅ |
| `SELECT ... FOR UPDATE` (row lock) | ✅ |
| UNIQUE constraints | ✅ |
| Atomic transactions (COMMIT/ROLLBACK) | ✅ |
| CHECK constraints | ✅ (since 8.0.16) |
| JSON columns | ✅ (slightly different from JSONB but sufficient) |
| `utf8mb4` charset | ✅ (full Unicode including emoji) |
| `SKIP LOCKED` (for queue) | ✅ (since 8.0) |
| CTE & window functions | ✅ (since 8.0) |

## Consequences

### Positive
- ✅ Works on virtually all shared hosting providers
- ✅ Single database engine to support across profiles
- ✅ All financial safety requirements met
- ✅ Mature ecosystem in Iran

### Negative
- ⚠️ JSON columns in MySQL are slightly slower than PostgreSQL JSONB
- ⚠️ Some Prisma features (e.g., `Json` filtering) work but with caveats
- ⚠️ No native array type (use JSON column workaround)
- ⚠️ Idempotency key length is limited to 64 chars (sufficient for UUIDs)

### Mitigations
- Use JSON columns sparingly — only for metadata, validation rules, and dynamic form options
- Keep all financial data in normalized tables (not in JSON)
- Use lookup tables for high-volume enums

## Money Storage Convention

All money is stored as `BIGINT` in minor units (Toman × 100 = Rial). This:
- Avoids floating-point rounding errors
- Allows exact integer math (add, subtract)
- Compatible with all database engines
- Easy to format for display

## References

- ADR-0001: Dual Deployment Profile
- TASKS.md Phase 1.2: Database Foundation
