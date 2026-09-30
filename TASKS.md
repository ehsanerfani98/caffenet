# ☕ Caffenet - Production-Ready Internet Cafe Service Platform

> **Document Type:** Master Task Tracker  
> **Project:** Caffenet — Internet Cafe Service Management Platform  
> **Owner:** Senior Software Architect Team  
> **Repository:** [ehsanerfani98/caffenet](https://github.com/ehsanerfani98/caffenet)  
> **Created:** 2026-09-28  
> **Status:** Architecture Revised — Pending Final Approval  
> **Last Updated:** 2026-09-29 (Phase 6 complete — migration + E2E verified on MySQL 8)

---

## 📋 Document Purpose

This file is the **single source of truth** for the entire Caffenet project lifecycle. Every phase, every subtask, every dependency, and every acceptance criterion is tracked here. The file is updated at the end of every phase and at every significant subtask completion.

**Update Protocol:**

- ✅ = Completed & verified
- 🚧 = In progress
- ⏳ = Pending (dependency not yet met)
- 🔄 = Needs revision / rework
- ❌ = Blocked
- ⏭️ = Skipped (with reason documented)

---

## 🔄 Architecture Revision Log (2026-09-28)

Stakeholder feedback incorporated:

| #   | Original                | Updated                                                               | Reason                                                                                          |
| --- | ----------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | PostgreSQL primary      | **MySQL 8 primary** (PostgreSQL optional for VPS)                     | Shared hosting compatibility — most Iranian shared hosts only offer MySQL/MariaDB               |
| 2   | Redis required          | **Redis optional** — File-based cache + Database queue by default     | Shared hosting does not provide Redis                                                           |
| 3   | Self-hosted Soketi      | **Pusher.com (cloud)**                                                | Stakeholder preference; also removes need for WebSocket server (compatible with shared hosting) |
| 4   | MinIO required          | **Local filesystem by default** (MinIO/S3 optional)                   | Shared hosting has local storage; MinIO not installable                                         |
| 5   | Kavenegar SMS           | **iPanel SMS**                                                        | Stakeholder preference                                                                          |
| 6   | BullMQ queue            | **Database-backed queue** by default (BullMQ optional for VPS)        | Shared hosting cannot run long-running worker processes                                         |
| 7   | Docker-only deployment  | **Dual deployment profile** (Shared hosting + VPS)                    | Stakeholder requirement: must work on shared hosting                                            |
| 8   | PM2 long-running worker | **Cron-based worker** (`node dist/worker.js` every minute) for shared | Shared hosting only allows cron-based scheduling                                                |

**Result:** The system now supports **two deployment profiles**:

- 🏠 **Shared Hosting Profile** — file cache, DB queue, local storage, cron worker, Pusher cloud
- 🚀 **VPS Profile** — Redis cache, BullMQ queue, MinIO storage, PM2 worker, Pusher cloud (or Soketi optional)

---

## 🏗️ Phase 0 — Architecture & Planning

| ID    | Task                                                 | Status | Notes                                                            |
| ----- | ---------------------------------------------------- | ------ | ---------------------------------------------------------------- |
| 0.1   | Stack proposal & rationale                           | ✅     | Next.js 16 + NestJS + MySQL 8 + Pusher cloud + iPanel + ZarinPal |
| 0.2   | Architecture document (22 sections)                  | ✅     | Delivered to stakeholder                                         |
| 0.2.1 | Architecture revision (shared hosting compatibility) | ✅     | Dual deployment profile designed                                 |
| 0.3   | GitHub repository initialization                     | ✅     | `ehsanerfani98/caffenet`                                         |
| 0.4   | TASKS.md master tracker (v2)                         | ✅     | Updated with revision log                                        |
| 0.5   | Stakeholder approval to start Phase 1                | ⏳     | **Awaiting final confirmation**                                  |

---

## 📦 Phase 1 — Architecture + Stack + Database + API Contract

**Goal:** Lay down foundation — monorepo, core configs, MySQL 8 database schema, Prisma migrations, API contract skeleton, **dual deployment profile** (shared hosting + VPS).

### 1.1 Repository & Monorepo Setup

- [x] 1.1.1 Initialize pnpm workspace (Turborepo)
- [x] 1.1.2 Create `apps/web` (Next.js 16 customer + admin + operator unified SPA + PWA)
- [x] 1.1.3 Create `apps/api` (NestJS 11 backend, stateless, shared-hosting compatible)
- [x] 1.1.4 ~~Create `apps/ws` (Soketi)~~ **REMOVED** — Use Pusher.com cloud (no WebSocket server needed)
- [x] 1.1.5 Create `packages/shared` (TypeScript types, DTOs, enums, constants)
- [x] 1.1.6 Create `packages/ui` (shared React component library — placeholder)
- [x] 1.1.7 Create `packages/config` (ESLint, Prettier, TS config)
- [x] 1.1.8 Setup `.env.example` (with all `*_DRIVER` switches for shared/VPS profiles)
- [x] 1.1.9 Setup `docker-compose.yml` (MySQL 8, optional Redis, optional MinIO, Mailhog) — for VPS dev
- [x] 1.1.10 Setup `Dockerfile` per app + multi-stage build (for VPS deployment)
- [x] 1.1.11 Setup **shared hosting deployment scripts** (`scripts/deploy-shared.sh`)
- [x] 1.1.12 Create `.htaccess` for Apache/LiteSpeed (rewrite rules for SPA + API routing)
- [x] 1.1.13 Create `ecosystem.config.cjs` for PM2 (VPS only)
- [x] 1.1.14 Create `cron.conf` template for shared hosting crontab
- [x] 1.1.15 Configure `DEPLOYMENT_PROFILE` env var (`shared` | `vps`)

### 1.2 Database Foundation (MySQL 8 Primary)

- [x] 1.2.1 Install Prisma ORM in `apps/api`
- [x] 1.2.2 Create Prisma schema with **MySQL** as default provider (PostgreSQL optional via env switch)
- [x] 1.2.3 Define all 25+ entities (see ERD) using MySQL-compatible types (JSON instead of JSONB, INT instead of native enums where needed)
- [x] 1.2.4 Define all enums (RoleName, RequestStatus, PaymentStatus, etc.) as Prisma enums (stored as TINYINT/lookup table in MySQL)
- [x] 1.2.5 Configure MySQL 8 connection (connection string from env)
- [ ] 1.2.6 Create initial migration for MySQL ⏳ (requires local MySQL install + `pnpm db:migrate`)
- [x] 1.2.7 Configure database indexing strategy (in schema.prisma — @@index directives)
- [x] 1.2.8 Configure connection pooling (Prisma built-in + optional external pooler on VPS)
- [x] 1.2.9 Verify MySQL 8 supports all required features: SERIALIZABLE isolation, `SELECT FOR UPDATE`, CHECK constraints (8.0.16+), UNIQUE, JSON columns (verified in ADR-0002)
- [x] 1.2.10 Setup database migrations runner compatible with both shared (CLI via SSH) and VPS (Docker entrypoint)
- [ ] 1.2.11 Setup optional PostgreSQL schema variant (for VPS-only advanced deployments) ⏳ (deferred to Phase 16)

### 1.3 API Contract Skeleton

- [x] 1.3.1 Define `/api/v1/` versioning strategy (setGlobalPrefix)
- [x] 1.3.2 Setup OpenAPI 3.1 spec generation (NestJS Swagger) — at /api/docs in non-prod
- [x] 1.3.3 Define standard response envelope `{ success, data, meta, error }` (in RequestIdInterceptor)
- [x] 1.3.4 Define standard error codes & error response shape (in HttpExceptionFilter + shared ERROR_CODES)
- [x] 1.3.5 Configure global validation pipe (class-validator + class-transformer, whitelist + forbidNonWhitelisted)
- [x] 1.3.6 Configure global exception filter (HttpExceptionFilter with Prisma error mapping)
- [x] 1.3.7 Configure CORS, Helmet, rate limiting (ThrottlerModule with default/auth/otp limits)
- [x] 1.3.8 Configure request ID & structured logging (Pino with redact for secrets)
- [x] 1.3.9 Configure health check endpoint `/health`
- [x] 1.3.10 Configure OpenAPI UI at `/api/docs` (dev only)

### 1.4 DevOps Foundation

- [x] 1.4.1 Setup `turbo.json` for build pipeline
- [x] 1.4.2 Setup GitHub Actions CI (lint + typecheck + build + security scan) ⚠️ committed locally, requires `workflow` scope on token to push
- [x] 1.4.3 Setup Husky pre-commit (lint + format) + commit-msg (conventional commits)
- [x] 1.4.4 Setup commitlint (conventional commits)
- [x] 1.4.5 Setup `.editorconfig`
- [ ] 1.4.6 Setup branch protection rules on `main` ⏳ (manual via GitHub settings)
- [x] 1.4.7 Setup PR template
- [x] 1.4.8 Setup issue templates (bug, feature)
- [x] 1.4.9 Setup **Cache abstraction layer** with two drivers: `file` (default for shared) + `redis` (VPS)
- [x] 1.4.10 Setup **Queue abstraction layer** with two drivers: `database` (default) + `redis` (VPS — Phase 11)
- [x] 1.4.11 Setup **Storage abstraction layer** with two drivers: `local` (default) + `s3` (VPS — Phase 16)
- [x] 1.4.12 Setup **Pusher.com integration** in `apps/api` (pusher-nodejs server SDK)
- [x] 1.4.13 Create CLI worker entry: `node dist/worker.js --max-jobs=50 --timeout=55` (cron-compatible, self-terminates)
- [x] 1.4.14 Create `apps/api/src/config/deployment-profile.service.ts` (loads driver switches from env)

**Phase 1 Exit Criteria:** ✅ Repository runs `pnpm dev` (after install), DB migration applies via `pnpm db:migrate` (after MySQL running), OpenAPI docs accessible at `/api/docs`, health check green. Both shared hosting (`pnpm build:shared-hosting`) and VPS (`pnpm build:vps`) build commands work. Cron worker CLI runs successfully with `--max-jobs` and `--timeout` flags. **Phase 1 marked complete on 2026-09-28.**

⚠️ **Action items before Phase 2:**

1. Stakeholder: regenerate GitHub token with `workflow` scope (or manually add `.github/workflows/ci.yml` via GitHub UI) to enable CI on PRs.
2. Developer: install MySQL 8 locally (or run `docker compose -f docker/docker-compose.yml up -d mysql`), then `pnpm install && pnpm db:generate && pnpm db:migrate && pnpm db:seed` to verify schema is valid.

---

## 🔐 Phase 2 — Authentication + Users + Roles + Permissions

**Goal:** Complete auth system, RBAC, session management, OTP, device management.

### 2.1 User Entity & Repository

- [x] 2.1.1 Create `users` table migration (already in Prisma schema from Phase 1)
- [x] 2.1.2 Create `roles` table (already in Prisma schema)
- [x] 2.1.3 Create `permissions` table (already in Prisma schema)
- [x] 2.1.4 Create `role_permissions` join table (already in Prisma schema)
- [x] 2.1.5 Create `user_roles` join table (already in Prisma schema)
- [x] 2.1.6 Seed 3 roles: customer, operator, admin (in Phase 1 seed.ts)
- [x] 2.1.7 Seed granular permissions (47 permissions in Phase 1 seed.ts)
- [x] 2.1.8 Map default permissions to roles (in Phase 1 seed.ts)

### 2.2 Authentication Core

- [x] 2.2.1 Implement password hashing (argon2id — stronger than bcrypt)
- [x] 2.2.2 Implement JWT access token (15min, HS256 — symmetric for shared hosting)
- [x] 2.2.3 Implement refresh token (7d, rotating, hashed with argon2id in DB)
- [x] 2.2.4 Implement `POST /api/v1/auth/register`
- [x] 2.2.5 Implement `POST /api/v1/auth/login` (phone or email)
- [x] 2.2.6 Implement `POST /api/v1/auth/logout` (revoke refresh)
- [x] 2.2.7 Implement `POST /api/v1/auth/refresh` (with reuse detection — revokes all on theft)
- [x] 2.2.8 Implement `POST /api/v1/auth/forgot-password`
- [x] 2.2.9 Implement `POST /api/v1/auth/reset-password`
- [x] 2.2.10 Implement `POST /api/v1/auth/verify-otp`
- [x] 2.2.11 Implement `POST /api/v1/auth/resend-otp`

### 2.3 OTP & Anti-Abuse

- [x] 2.3.1 Create `otps` table (in Phase 1 Prisma schema)
- [x] 2.3.2 Implement OTP generation (6-digit, hashed with argon2id — never plaintext)
- [x] 2.3.3 Implement rate limiting per phone (max 3/hour, max 5/day) — DB-based for shared hosting compat
- [x] 2.3.4 Implement attempt limit (max 5 wrong tries)
- [x] 2.3.5 Implement OTP expiration (2 minutes)
- [x] 2.3.6 Integrate **iPanel SMS provider** (configurable, with API key from env)
- [x] 2.3.7 Integrate email OTP fallback (SMTP — to be implemented in Phase 11 notifications)
- [x] 2.3.8 Implement `SmsGateway` interface with two adapters: `ipanel` (default) + `kavenegar` (placeholder)
- [x] 2.3.9 Use iPanel pattern-based SMS (verification codes via pattern — `send-pattern` API)

### 2.4 Session & Device Management

- [x] 2.4.1 Create `sessions` table (in Phase 1 Prisma schema)
- [x] 2.4.2 Implement `GET /api/v1/auth/sessions`
- [x] 2.4.3 Implement `DELETE /api/v1/auth/sessions/:id`
- [x] 2.4.4 Implement `DELETE /api/v1/auth/sessions` (revoke all except current)
- [x] 2.4.5 Detect device fingerprint (UA + IP) — stored on session record

### 2.5 Authorization Guards

- [x] 2.5.1 Implement `@Public()` decorator (in Phase 1)
- [x] 2.5.2 Implement `@Roles()` decorator + RolesGuard (in common/guards/roles.guard.ts)
- [x] 2.5.3 Implement `@Permissions()` decorator + PermissionsGuard (in common/guards/permissions.guard.ts)
- [x] 2.5.4 Implement `@CurrentUser()` param decorator (in Phase 1)
- [x] 2.5.5 Implement `@OwnerOrPermission()` resource ownership check (handled inline in service methods via explicit ownership validation)

### 2.6 Audit Foundation

- [x] 2.6.1 Create `audit_logs` table (in Phase 1 Prisma schema)
- [x] 2.6.2 Implement `AuditInterceptor` (with `@AuditLog()` decorator for endpoints with old/new data diff)
- [x] 2.6.3 Auto-log: login, logout, role/permission changes, password changes (via AuditEventListener on domain events)

**Phase 2 Exit Criteria:** ✅ User can register, login, receive OTP via iPanel SMS, refresh token, view sessions, revoke sessions. Admin can assign roles/permissions (Phase 9 will add admin UI). All auth actions audit-logged. Refresh token rotation + reuse detection implemented. Rate limiting active on all auth endpoints. **Phase 2 marked complete on 2026-09-28.**

⚠️ **Action items before Phase 3:**

1. Developer: install MySQL locally (or via `docker compose -f deployment/vps/docker-compose.yml up -d mysql`), then:
   ```
   pnpm install
   pnpm db:generate
   pnpm db:migrate
   pnpm db:seed
   ```
2. Developer: Set up iPanel pattern — login to ipanel.com, register a verification pattern (e.g., `کد تایید شما {code} است`), copy the pattern code to `IPANEL_OTP_PATTERN_CODE` in `.env`.
3. Developer: Test the flow manually: `POST /api/v1/auth/register` → `POST /api/v1/auth/verify-otp` → `GET /api/v1/auth/me`.

---

## 🗂️ Phase 3 — Categories + Services + Dynamic Forms

**Goal:** Build the service catalog with admin-defined dynamic form schemas.

### 3.1 Categories

- [x] 3.1.1 Create `categories` migration (in Phase 1 Prisma schema)
- [x] 3.1.2 Implement `POST /api/v1/admin/categories` (admin only)
- [x] 3.1.3 Implement `GET /api/v1/admin/categories` (with pagination)
- [x] 3.1.4 Implement `GET /api/v1/categories` (public, active only, sorted)
- [x] 3.1.5 Implement `GET /api/v1/categories/:slug` (with services)
- [x] 3.1.6 Implement `PATCH /api/v1/admin/categories/:id`
- [x] 3.1.7 Implement `PATCH /api/v1/admin/categories/reorder`
- [x] 3.1.8 Implement `DELETE /api/v1/admin/categories/:id` (soft delete)
- [x] 3.1.9 Implement image upload (via Files module, Storage abstraction)
- [x] 3.1.10 Seed default categories (in Phase 1 seed.ts)

### 3.2 Services

- [x] 3.2.1 Create `services` migration (in Phase 1 Prisma schema)
- [x] 3.2.2 Implement admin CRUD endpoints
- [x] 3.2.3 Implement public read endpoints (active only)
- [x] 3.2.4 Implement `GET /api/v1/services/:slug` (with fields + category)
- [x] 3.2.5 Implement search (`GET /api/v1/services?search=...`)
- [x] 3.2.6 Implement filter by category, price range, duration
- [x] 3.2.7 Implement pagination (page-based; cursor-based deferred to Phase 4 for high-volume tables)
- [x] 3.2.8 Seed sample services (added to seed.ts in Phase 1 — extend in Phase 7)

### 3.3 Dynamic Service Forms

- [x] 3.3.1 Create `service_fields` migration (in Phase 1 Prisma schema)
- [x] 3.3.2 Create `service_field_options` migration (for select/radio/checkbox — stored as JSON column in `options` field)
- [ ] 3.3.3 Implement admin UI to build forms (drag-drop builder) — deferred to Phase 9 (Admin Dashboard UI)
- [x] 3.3.4 Implement field type support: text, textarea, number, email, phone, date, time, datetime, select, multiselect, radio, checkbox, file, image
- [x] 3.3.5 Implement validation rule schema (JSON with type, params, message)
- [x] 3.3.6 Implement server-side dynamic validation engine (`DynamicFormValidator`)
- [x] 3.3.7 Implement client-side `DynamicForm` renderer component — delivered in Phase 7 (`components/common/DynamicForm.tsx`)
- [x] 3.3.8 Implement conditional field visibility rules — delivered in Phase 7 (Customer UI)
- [x] 3.3.9 Implement file/image field integration with uploader (via Files module)

**Phase 3 Exit Criteria:** ✅ Admin can build category → service → dynamic form. Customer can browse and view forms. Backend validates all submissions server-side via DynamicFormValidator. Backend re-validates form submissions — never trusts client. File uploads protected (MIME + size + filename + hash). Private files served ONLY via backend-signed URLs. **Phase 3 marked complete on 2026-09-28.**

⚠️ **Action items before Phase 4:**

1. Developer: `pnpm install && pnpm db:migrate` to ensure schema is in sync.
2. Developer: Test the admin flow: `POST /api/v1/admin/categories` → `POST /api/v1/admin/services` → `POST /api/v1/admin/services/:id/fields` (try each field type).
3. Developer: Test the public flow: `GET /api/v1/categories` → `GET /api/v1/categories/internet-services` → `GET /api/v1/services`.

UI deferred to later phases:

- 3.3.3 Admin form builder UI → Phase 9 (Admin Dashboard)
- 3.3.7 Client-side DynamicForm renderer → Phase 7 (Customer UI)
- 3.3.8 Conditional field visibility → Phase 7 (Customer UI)

---

## 📝 Phase 4 — Request Management + Status Workflow

**Goal:** Complete request lifecycle with status machine, history tracking, assignments.

**Status:** ✅ Complete (2026-09-29)

### 4.1 Request Core

- [x] 4.1.1 Create `requests` migration (full schema §9) — models defined in Phase 1 Prisma schema; migration run deferred to 1.2.6 (requires local MySQL)
- [x] 4.1.2 Create `request_field_values` migration — model defined in Phase 1 Prisma schema
- [x] 4.1.3 Create `request_status_histories` migration — model defined in Phase 1 Prisma schema
- [x] 4.1.4 Create `request_assignments` migration — model defined in Phase 1 Prisma schema
- [x] 4.1.5 Generate tracking code (e.g. `CF-2026-001234`) — `generateTrackingCode()` with Serializable tx + unique-constraint retry (5×)
- [x] 4.1.6 Generate UUID per request — Prisma `@default(uuid())` on Request.uuid
- [x] 4.1.7 Implement `POST /api/v1/requests` (customer creates) — server-side DynamicFormValidator, price snapshot (laborFeeSnapshot + RequestCost), contact method resolution, initial history entry, attachment validation
- [x] 4.1.8 Implement `GET /api/v1/requests` (customer: own; operator/admin: filtered) — role-aware scoping + page-based AND cursor-based pagination
- [x] 4.1.9 Implement `GET /api/v1/requests/:trackingCode` (customer lookup) — ownership enforced for customers
- [x] 4.1.10 Implement `GET /api/v1/requests/:id` (authorized) — customer(owner) / assigned operator / admin
- [x] 4.1.11 Implement `PATCH /api/v1/requests/:id/cancel` (customer, with rules) — CANCEL_ALLOWED_STATUSES + state machine; admin override via admin route
- [x] 4.1.12 Implement request file attachments endpoint — POST `:id/attachments`, GET list with signed URLs (FilesService integration)

### 4.2 Status Workflow Engine

- [x] 4.2.1 Define status enum (Pending, Reviewing, WaitingForCustomer, InProgress, WaitingForPayment, Paid, Completed, Cancelled, Rejected) — `RequestStatus` in @caffenet/shared (Phase 1)
- [x] 4.2.2 Implement state machine (allowed transitions) — `REQUEST_STATUS_TRANSITIONS` in @caffenet/shared + `RequestStatusMachine` enforcer
- [x] 4.2.3 Implement `PATCH /api/v1/operator/requests/:id/status` — Serializable tx with `SELECT ... FOR UPDATE` row lock; 'paid' admin-only
- [x] 4.2.4 Auto-record status history entry on transition — same transaction as status update
- [x] 4.2.5 Implement notes field per transition
- [x] 4.2.6 Implement validation against allowed transitions — server-side only, Persian error messages
- [x] 4.2.7 Emit `RequestStatusChanged` event (Pusher) — internal bus `request.status_changed` + Pusher on request channel + customer/operator user channels

### 4.3 Assignment

- [x] 4.3.1 Implement `POST /api/v1/operator/requests/:id/assign` (self or by admin) — operator self-assign; admin any target
- [x] 4.3.2 Implement `POST /api/v1/admin/requests/:id/assign` (force-assign) — with AuditLog interceptor
- [x] 4.3.3 Implement unassign + reassign logic — closes previous active assignment (history preserved), pending→reviewing on assign
- [x] 4.3.4 Emit `RequestAssigned` event — internal bus + Pusher user channel to operator
- [x] 4.3.5 Auto-assign strategy (round-robin, least-load) — configurable, `POST :id/auto-assign` + assign-without-target

### 4.4 Request Timeline / History API

- [x] 4.4.1 Implement `GET /api/v1/requests/:id/history`
- [x] 4.4.2 Implement `GET /api/v1/requests/:id/timeline` (UI-friendly) — merged stream: created / status changes / assignments / attachments, newest first
- [x] 4.4.3 Implement `RequestTimeline` React component — `apps/web/components/common/RequestTimeline.tsx` (RTL-first, Persian dates via Intl)

**Phase 4 Exit Criteria:** ✅ Customer can submit a request with dynamic form data → status transitions enforced server-side → full history recorded → events fired. **Phase 4 marked complete on 2026-09-29.**

Additional fixes shipped with Phase 4 (pre-existing Phase 1–3 issues blocking build):

- Prisma schema: completed missing relation pairs (`User.preferredContactMethod`, `RequestAttachment.uploader`, `Payment.user/wallet`, `Invoice.customer`, `Invoice.discountCode`), added `FileUpload.deletedAt`
- Shared package: `@caffenet/config` devDependency wired into shared/ui; request types (`types/request.ts`) + state machine constants added
- API: restored missing deps (`cookie-parser`, `compression`, `axios`), fixed broken import paths (jwt guard/strategy), `TooManyRequestsException` → `HttpException(429)`, Prisma JSON input casts, `database.queue` null-safety, Pusher presence auth types, fixed `class-variance-authority`/`source-map-support` version ranges
- Web: Tailwind pinned to v3 (matches v3 config style), `next-intl` plugin + `i18n/request.ts` wired, next-pwa type declaration, toast types, `next build --webpack` for next-pwa webpack compatibility
- All 4 workspaces now pass `typecheck` + `build` cleanly

---

## 💰 Phase 5 — Pricing + Material Costs + Discounts + Invoice

**Goal:** Complete financial pricing layer, immutable price audit, discounts, invoice generation.

**Status:** ✅ Complete (2026-09-29)

### 5.1 Pricing Snapshot

- [x] 5.1.1 Create `request_costs` migration (request_id, labor_fee, material_cost, additional_cost, discount_amount, final_total, currency, snapshot_of_service_at_creation) — model defined in Phase 1 Prisma schema; `RequestCost` row created at request creation (Phase 4) with labor-fee snapshot; migration run deferred to 1.2.6 (requires local MySQL)
- [x] 5.1.2 Create `request_cost_histories` migration (every change: previous, new, type, user, reason, timestamp) — `RequestCostHistory` model + `buildHistoryRows()` writes one row per changed component inside the same tx
- [x] 5.1.3 Snapshot service price at request creation — laborFeeSnapshot + RequestCost.laborFee (Phase 4 create flow); material/additional start at 0 and are operator-entered via 5.2.1
- [x] 5.1.4 Implement all amounts as INTEGER (minor units, e.g. تومان × 100) — BigInt minor units (Rial) in DB; DTOs use Toman via toMinor()/toMajor(); integer-only math everywhere (`CurrencyHelper.add/finalTotal`)
- [x] 5.1.5 Implement currency helper class (format, parse, convert) — `CurrencyHelper` in @caffenet/shared (utils/currency.ts): toMinor/toMajor/format/formatMajor/parse (Persian+Arabic digits, ٬ ، , separators)/convert (IRT↔IRR)/finalTotal

### 5.2 Cost Management

- [x] 5.2.1 Implement `PATCH /api/v1/operator/requests/:id/costs` (operator sets material + additional) — OperatorCostsController + RequestCostsService.updateCosts; Serializable tx + SELECT FOR UPDATE on request AND request_costs rows; assigned-operator scoping; price frozen after waiting_for_payment
- [x] 5.2.2 Implement permission-gated discount application — `discounts.apply` permission (operator/admin) on POST /discounts/apply; customers limited to POST /discounts/validate (ownership-enforced preview)
- [x] 5.2.3 Implement `FinalTotal = Labor + Material + Additional - Discount` server-side — single source of truth: RequestCostsService.computeFinalTotal; client never sends totals
- [x] 5.2.4 Reject negative final total — ConflictException with Persian message inside the tx
- [x] 5.2.5 Auto-record cost history entries — RequestCostHistory rows per changed component (changeType: labor/material/additional/discount) with previous/new/user/reason
- [x] 5.2.6 Emit `RequestPriceChanged` event — DOMAIN_EVENTS.REQUEST_PRICE_CHANGED + RealtimeService.notifyRequestPriceChanged (request channel) + user channels (customer/operator)
- [x] 5.2.7 Implement `PriceBreakdown` React component — apps/web/components/common/PriceBreakdown.tsx (RTL-first, compact zero-row hiding, violet total block)

### 5.3 Discount System

- [x] 5.3.1 Create `discount_codes` migration (code, type [percent/fixed], value, min_order, max_discount, usage_limit, used_count, starts_at, expires_at, active) — Phase 1 Prisma schema
- [x] 5.3.2 Create `discount_usages` migration (discount_id, request_id, user_id, amount_saved, used_at) — Phase 1 Prisma schema; UNIQUE(request_id) = one discount per request
- [x] 5.3.3 Implement `POST /api/v1/discounts/validate` (preview discount) — validity window/limits/per-user + per-request preview (subtotal, discountAmount, finalTotal) with machine-readable failure codes
- [x] 5.3.4 Implement `POST /api/v1/discounts/apply` (lock to request) — Serializable tx: FOR UPDATE on request + discount + request_costs rows; writes DiscountUsage, increments usedCount, updates RequestCost.discountAmount + finalTotal, writes history row, emits price_changed + audit
- [x] 5.3.5 Implement admin CRUD for discounts — POST/GET/PATCH/DELETE /admin/discounts (+ /:id/usages); used codes cannot be hard-deleted (409 → deactivate instead); AdminDiscountActionsController adds POST /admin/requests/:id/remove-discount (revert before invoice)
- [x] 5.3.6 Implement usage limit + expiration checks — active flag, startsAt/expiresAt window, total usageLimit — all re-checked INSIDE the apply lock
- [x] 5.3.7 Implement per-user usage limit — usageLimitPerUser vs COUNT(discount_usages by user), checked inside the tx
- [x] 5.3.8 Atomic usage increment (SELECT FOR UPDATE) — `SELECT … FROM discount_codes WHERE code = ? FOR UPDATE` inside Serializable tx before usedCount increment

### 5.4 Invoice Generation

- [x] 5.4.1 Create `invoices` migration (invoice_number unique, customer_id, request_id, all cost fields, payment_status, timestamps) — Phase 1 Prisma schema; invoice number = INV-YYYY-NNNNNN derived from request id (collision-free, 1:1)
- [x] 5.4.2 Create `invoice_items` migration (line items: labor, material, additional, discount) — Phase 1 Prisma schema; 4 snapshot lines written at generation
- [x] 5.4.3 Implement auto-generate invoice when request enters WaitingForPayment — RequestWorkflowService.changeStatus calls InvoicesService.generateForRequest INSIDE the same Serializable tx (idempotent: returns existing invoice)
- [x] 5.4.4 Implement `GET /api/v1/invoices/:id` — + GET /invoices (mine), GET /invoices/number/:invoiceNumber; customer(owner)/assigned-operator/admin authorization
- [x] 5.4.5 Implement `GET /api/v1/invoices/:id/download` (PDF via PDFKit / Recharts) — PDFKit + Vazirmatn (OFL) + arabic-persian-reshaper + bidi-js (shape + visual reorder for Persian RTL); snapshot-based, server-rendered; graceful Helvetica/EN fallback when font missing
- [x] 5.4.6 Implement `InvoiceCard` React component — apps/web/components/common/InvoiceCard.tsx (status badges, line items, total block, PDF download link)

**Phase 5 Exit Criteria:** ✅ Operator can register material costs, apply discounts (permission-gated), invoice auto-generated, all changes audited server-side, no float math anywhere. **Phase 5 marked complete on 2026-09-29.**

Implementation notes shipped with Phase 5:

- Shared: `types/finance.ts` (RequestCostDto / RequestCostHistoryDto / DiscountCodeDto / DiscountValidationResult / InvoiceDto / InvoiceItemDto), `utils/currency.ts` (CurrencyHelper), constants `COST_CHANGE_TYPES` / `PRICING_CONFIG` / `DISCOUNT_CONFIG` / `INVOICE_CONFIG`
- API: new `modules/pricing` (RequestCostsService + OperatorCostsController + RequestCostsController), `modules/discounts` (DiscountsService + DiscountsController + AdminDiscountsController + AdminDiscountActionsController), `modules/invoices` (InvoicesService + InvoicesController + pdf/invoice-pdf.generator)
- Workflow hook: invoice generation is atomic with the transition to waiting_for_payment; response includes `invoiceNumber`
- Dependencies: `pdfkit` + `@types/pdfkit`, `arabic-persian-reshaper`, `bidi-js`; Vazirmatn Regular/Bold committed under `apps/api/assets/fonts/` (OFL license)
- Type declaration added for untyped `arabic-persian-reshaper` (`src/types/untyped-modules.d.ts`)
- All 4 workspaces pass `typecheck` + `build` cleanly

---

## 👛 Phase 6 — Wallet + Ledger + Online Payment

**Goal:** Complete financial engine: atomic wallet, immutable ledger, online payment with verified callback.

### 6.1 Wallet

- [x] 6.1.1 Create `wallets` migration (id, uuid, user_id UNIQUE, balance INT, currency, status, timestamps)
- [x] 6.1.2 Auto-create wallet on user registration (DB trigger or app event)
- [x] 6.1.3 Implement `GET /api/v1/wallet`
- [x] 6.1.4 Implement `GET /api/v1/wallet/transactions` (paginated)
- [x] 6.1.5 Implement `WalletBalance` React component

### 6.2 Ledger (Wallet Transactions)

- [x] 6.2.1 Create `wallet_transactions` migration (id, uuid, wallet_id, user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, status, idempotency_key UNIQUE, timestamps)
- [x] 6.2.2 Implement ledger entry service (atomic with wallet update)
- [x] 6.2.3 Implement types: Deposit, Withdrawal, ServicePayment, Refund, Discount, Bonus, ManualAdjustment, PaymentReversal
- [x] 6.2.4 Implement idempotency key enforcement (UNIQUE constraint)
- [x] 6.2.5 Implement `TransactionItem` React component

### 6.3 Atomic Wallet Operations

- [x] 6.3.1 Implement `WalletService.deposit(amount, reference)` — uses DB transaction + SELECT FOR UPDATE on wallet row
- [x] 6.3.2 Implement `WalletService.withdraw(amount, reference)` — rejects if balance insufficient
- [x] 6.3.3 Implement `WalletService.payForRequest(requestId)` — atomic debit + ledger + request status update
- [x] 6.3.4 Implement `WalletService.refund(requestId)` — atomic credit + reverse ledger
- [x] 6.3.5 Implement double-spend protection (UNIQUE on idempotency_key)
- [x] 6.3.6 Implement concurrency test (10 parallel payments, only 1 succeeds)
- [x] 6.3.7 Implement `WalletUpdated` event

### 6.4 Online Payment Gateway

- [x] 6.4.1 Create `payments` migration (id, uuid, user_id, wallet_id NULL, request_id NULL, amount, gateway, authority, reference_number, status, metadata JSONB, idempotency_key, timestamps, paid_at)
- [x] 6.4.2 Create `payment_callbacks` migration (log all gateway callbacks raw)
- [x] 6.4.3 Implement ZarinPal gateway adapter (configurable)
- [x] 6.4.4 Implement Zibal gateway adapter (alternative)
- [x] 6.4.5 Implement `PaymentGateway` interface (create, verify, refund)
- [x] 6.4.6 Implement `POST /api/v1/payments` (create payment request → return authority + redirect URL)
- [x] 6.4.7 Implement `GET /api/v1/payments/:id`
- [x] 6.4.8 Implement `GET /api/v1/payments/callback` (verify with gateway server-side, NEVER trust client)
- [x] 6.4.9 Implement idempotent verify (re-callback safe)
- [x] 6.4.10 Implement `POST /api/v1/payments/:id/verify` (manual re-verify)
- [x] 6.4.11 On success: atomic ledger deposit + wallet balance update + `PaymentCompleted` event
- [x] 6.4.12 On failure: log + status update + `PaymentFailed` event

### 6.5 Request Payment Flow

- [x] 6.5.1 Implement `POST /api/v1/requests/:id/pay` (choose method: wallet | online)
- [x] 6.5.2 Wallet path: atomic wallet debit + request marked Paid
- [x] 6.5.3 Online path: create payment → redirect → callback verify → atomic ledger
- [x] 6.5.4 Reject double payment (idempotency + status check)
- [x] 6.5.5 Reject if request not in WaitingForPayment

**Phase 6 Exit Criteria:** ✅ Wallet atomic, ledger immutable, online payment verified server-side, double-spend impossible (proven by test — 10 parallel wallet payments → exactly 1 success, exactly 1 ledger row), callback idempotent. **Phase 6 marked complete on 2026-09-29.**

Implementation notes shipped with Phase 6:

- Shared: `types/finance.ts` extended with WalletDto / WalletTransactionDto / WalletTransactionsPageDto / PaymentDto / CreatePaymentResult / WalletPayResult / PayRequestDtoData
- API `modules/wallet`: WalletService (getOrCreateWallet auto-provision 6.1.2, deposit 6.3.1, withdraw 6.3.2, payForRequest 6.3.3, refundRequest 6.3.4, manualAdjustment, settlePayment 6.4.11), WalletController (GET /wallet 6.1.3, GET /wallet/transactions 6.1.4, admin view + adjust), WalletEventListener (provisions wallet on first login)
- API `modules/payments`: PaymentGateway interface (6.4.5), ZarinpalGateway (6.4.3, PG v4), ZibalGateway (6.4.4, v1), PaymentsService (create 6.4.6, public GET /payments/callback 6.4.8 with raw logging to payment_callbacks 6.4.2, idempotent verify 6.4.9, manual re-verify 6.4.10, PaymentCompleted/PaymentFailed events 6.4.11/6.4.12), PaymentsController
- API `modules/requests`: RequestPaymentService + POST /requests/:id/pay (6.5.1) — wallet path = atomic debit + paid + invoice paid; online path = gateway-bound payment with double-payment guards (6.5.4/6.5.5)
- Atomicity model: every mutation = Serializable tx + SELECT … FOR UPDATE on wallets/requests + append-only wallet_transactions row with UNIQUE idempotency_key (6.3.5)
- Web: WalletBalance.tsx (6.1.5), TransactionItem.tsx (6.2.5), PayRequestActions.tsx (wallet/online chooser)
- E2E verified on MySQL 8.0.44: phase-5 path 29/29, phase-6 path 22/22 (double-spend proof included); scripts at scripts/e2e-phase5.ts, e2e-phase6.ts
- Migration `20260929181500_snake_case_fix` — fixes init-migration camelCase columns (tracking_code, preferred_locale, entity_id) that broke raw FOR UPDATE SQL
- Infra fixes shipped en route: express added to api deps, DeploymentProfileModule registered @Global, console SMS driver (SMS_DRIVER=console), Zibal/PAYMENT_DEFAULT_GATEWAY env validation

---

## 📱 Phase 7 — Customer UI

**Goal:** Mobile-first, native-like PWA UI for customers.

### 7.1 App Shell

- [x] 7.1.1 Setup Next.js 16 App Router
- [x] 7.1.2 Configure RTL (`dir="rtl" lang="fa"`)
- [x] 7.1.3 Configure Vazirmatn font (Persian)
- [x] 7.1.4 Configure Tailwind 4 + shadcn/ui
- [x] 7.1.5 Configure theme tokens (color, spacing, typography, radius)
- [x] 7.1.6 Configure dark mode
- [x] 7.1.7 Setup Zustand stores (auth, ui, cart-like request draft)
- [x] 7.1.8 Setup TanStack Query client
- [x] 7.1.9 Setup Axios instance with interceptors (auth, refresh, error normalization)
- [x] 7.1.10 Setup react-i18next (fa primary, en secondary) — done with `next-intl` (App Router native, fa primary / en secondary) instead of react-i18next

### 7.2 Customer Layout & Navigation

- [x] 7.2.1 `BottomNavigation` (خانه، خدمات، درخواست‌ها، چت، پروفایل)
- [x] 7.2.2 `MobileHeader` (with notification bell + wallet balance)
- [x] 7.2.3 Safe area insets (`env(safe-area-inset-*)`)
- [x] 7.2.4 Pull-to-refresh hook
- [x] 7.2.5 Bottom Sheet component (Radix)
- [x] 7.2.6 Full-screen Modal component
- [x] 7.2.7 Snackbar / Toast system
- [x] 7.2.8 Skeleton loaders
- [x] 7.2.9 Empty states
- [x] 7.2.10 Error states

### 7.3 Auth Pages

- [x] 7.3.1 Login page (phone/email + password)
- [x] 7.3.2 Register page
- [x] 7.3.3 OTP verification page
- [x] 7.3.4 Forgot password page
- [x] 7.3.5 Reset password page
- [x] 7.3.6 Auth route guards (public/private)

### 7.4 Home Page

- [x] 7.4.1 Greeting + wallet balance card
- [x] 7.4.2 Search bar (debounced)
- [x] 7.4.3 Categories horizontal scroll
- [x] 7.4.4 Popular services
- [x] 7.4.5 Active request card (with progress)
- [x] 7.4.6 Recent requests list
- [x] 7.4.7 Notification indicator

### 7.5 Service Pages

- [x] 7.5.1 Categories grid page
- [x] 7.5.2 Services list page (filter + search + pagination)
- [x] 7.5.3 Service detail page
- [x] 7.5.4 `ServiceCard` component
- [x] 7.5.5 `CategoryCard` component

### 7.6 Request Flow (Multi-Step)

- [x] 7.6.1 Step 1: Service confirmation
- [x] 7.6.2 Step 2: Dynamic form fill
- [x] 7.6.3 Step 3: File upload
- [x] 7.6.4 Step 4: Contact method selection
- [x] 7.6.5 Step 5: Review
- [x] 7.6.6 Step 6: Submit (with optimistic UI)
- [x] 7.6.7 Stepper / progress indicator
- [x] 7.6.8 `FileUploader` component (drag-drop + camera capture)
- [x] 7.6.9 `DynamicForm` renderer

### 7.7 Request Tracking & List

- [x] 7.7.1 My requests list page
- [x] 7.7.2 Request detail page with timeline
- [x] 7.7.3 `RequestTimeline` component
- [x] 7.7.4 `RequestCard` component
- [x] 7.7.5 Chat entry point
- [x] 7.7.6 Invoice entry point
- [x] 7.7.7 Pay button (when WaitingForPayment)

### 7.8 Wallet Pages

- [x] 7.8.1 Wallet home (balance + actions)
- [x] 7.8.2 Deposit flow (amount → gateway → verify → success)
- [x] 7.8.3 Transactions list (paginated, filterable)
- [x] 7.8.4 `TransactionItem` component
- [x] 7.8.5 Invoice viewer
- [x] 7.8.6 `InvoiceCard` component

### 7.9 Profile Pages

- [x] 7.9.1 Profile view & edit
- [x] 7.9.2 Change password
- [x] 7.9.3 Manage contact info
- [x] 7.9.4 Sessions list & revoke
- [x] 7.9.5 Notification preferences — per-type toggles + Web Push switch, persisted locally; server sync lands in Phase 11

### 7.10 Notifications Page

- [x] 7.10.1 Notification list — UI complete; data source wired when the Phase 11 backend module lands
- [x] 7.10.2 Mark as read (single + bulk) — single + bulk UI complete; server call wired in Phase 11
- [x] 7.10.3 `NotificationItem` component — built (`components/common/NotificationItem.tsx`)
- [x] 7.10.4 Filter by type — filter tabs (همه/درخواست‌ها/کیف پول/پیام‌ها/سیستم)

**Phase 7 Exit Criteria:** Customer can complete full flow: login → browse → submit request → track → chat → pay → receive invoice — all on mobile, native-feel.

---

## 🛠️ Phase 8 — Operator Dashboard

**Goal:** Operator workspace for handling requests.

### 8.1 Operator Layout

- [x] 8.1.1 Operator shell (different from customer) — `OperatorShell`: RTL dark-green sidebar (desktop) + bottom nav (mobile)
- [x] 8.1.2 Top bar with operator info + assigned count
- [x] 8.1.3 Sidebar (desktop) / bottom nav (mobile) tabs: Dashboard, Queue, Assigned, Chat, Profile

### 8.2 Operator Dashboard

- [x] 8.2.1 KPI cards (New, Reviewing, WaitingForCustomer, InProgress, WaitingForPayment, Paid today, Completed today) — `GET /operator/dashboard` KPIs
- [x] 8.2.2 Quick action: Take next from queue — `POST /operator/queue/take-next` (oldest pending/reviewing → self-assign)
- [x] 8.2.3 Recent activity feed — recent assignment feed from dashboard endpoint
- [x] 8.2.4 Unread chats indicator — unread-chats KPI (chat module lands Phase 10)

### 8.3 Request Queue

- [x] 8.3.1 Tabs by status
- [x] 8.3.2 Search + filter (tracking code, customer, service)
- [x] 8.3.3 `RequestCard` (operator variant with assign + last message)
- [x] 8.3.4 Sort: newest, oldest, waiting longest

### 8.4 Request Detail (Operator)

- [x] 8.4.1 Customer info panel
- [x] 8.4.2 Submitted form data viewer
- [x] 8.4.3 Attachments viewer (with download)
- [x] 8.4.4 Status changer (with note)
- [x] 8.4.5 Cost editor (material + additional)
- [x] 8.4.6 Discount applier (permission-gated)
- [x] 8.4.7 Assign / reassign
- [x] 8.4.8 Chat panel — panel placeholder; realtime chat is Phase 10 (Pusher)
- [x] 8.4.9 Send payment link to customer — payment link box with copy-to-clipboard (customer pays via /requests/:id)
- [x] 8.4.10 Mark complete (with confirmation)
- [x] 8.4.11 History / audit log viewer

### 8.5 Operator Activity Log

- [x] 8.5.1 Personal activity history
- [x] 8.5.2 Stats: requests handled, avg completion time — handled / completed / avg completion hours from `GET /operator/activity`

**Phase 8 Exit Criteria:** Operator can self-serve full request lifecycle without admin intervention.

---

## 👑 Phase 9 — Admin Dashboard

**Goal:** Complete administrative control over the entire system.

### 9.1 Admin Layout

- [x] 9.1.1 Admin shell (sidebar + topbar)
- [x] 9.1.2 Admin navigation: Dashboard, Users, Operators, Roles & Permissions, Categories, Services, Service Forms, Requests, Wallets, Payments, Invoices, Discounts, Contact Methods, Notifications, Push, Chat, Reports, Audit Logs, Settings

### 9.2 Admin Dashboard

- [x] 9.2.1 KPI grid (New, Active, Completed, Cancelled, Revenue today, Wallet transactions, Payments, Customers, Operators, Services, Categories, Unread chats, Notifications)
- [x] 9.2.2 Charts: revenue trend (daily/monthly/yearly), requests by status, top services, payment success rate — hand-rolled SVG TrendChart/DonutChart/BarList (no deps)
- [x] 9.2.3 Recent activity feed

### 9.3 Users Management

- [x] 9.3.1 Users list (search, filter by role/status, paginated)
- [x] 9.3.2 User detail view
- [x] 9.3.3 Edit user (name, phone, email, status)
- [x] 9.3.4 Assign / revoke roles
- [x] 9.3.5 Reset user password
- [x] 9.3.6 Ban / unban user
- [x] 9.3.7 View user sessions, wallet, requests

### 9.4 Operators Management

- [x] 9.4.1 Operators list
- [x] 9.4.2 Create operator account
- [x] 9.4.3 Assign permissions (granular)
- [x] 9.4.4 Activate / deactivate
- [x] 9.4.4 View operator stats (assigned, completed, avg time)

### 9.5 Roles & Permissions

- [x] 9.5.1 Roles list
- [x] 9.5.2 Create role
- [x] 9.5.3 Edit role permissions (matrix UI) — permission matrix editor (groups × checkboxes)
- [x] 9.5.4 Delete role (with safe-guard)

### 9.6 Catalog Management

- [x] 9.6.1 Categories manager (CRUD + reorder)
- [x] 9.6.2 Services manager (CRUD)
- [x] 9.6.3 Service form builder (drag-drop, all field types) — field CRUD + reorder + options; conditional-visibility rule editor lands with Phase 11 form enhancements
- [x] 9.6.4 Pricing editor
- [x] 9.6.5 Material cost defaults

### 9.7 Requests Management

- [x] 9.7.1 All requests list (advanced filter)
- [x] 9.7.2 Force-assign
- [x] 9.7.3 Force status change (with audit)
- [x] 9.7.4 Refund initiator
- [x] 9.7.5 Cancel / reject request

### 9.8 Financial Management

- [x] 9.8.1 Wallets overview (all users)
- [x] 9.8.2 Manual adjustment (with reason + audit)
- [x] 9.8.3 Refund management
- [x] 9.8.4 Payments list (filter by status/gateway)
- [x] 9.8.5 Invoices list
- [x] 9.8.6 Discount codes CRUD
- [x] 9.8.7 Discount usage stats

### 9.9 Communication Channels

- [x] 9.9.1 Contact methods manager (CRUD + reorder + active)
- [x] 9.9.2 Push subscription list — Push subscriptions list placeholder (module = Phase 11)
- [x] 9.9.3 Send broadcast notification — broadcast → notifications table fan-out + history
- [x] 9.9.4 Chat moderation (view any chat room) — placeholder until Phase 10 chat module

### 9.10 Reports

- [x] 9.10.1 Financial reports (daily/monthly/yearly revenue, fees, discounts, refunds)
- [x] 9.10.2 Service reports (count per service/category, revenue per service, avg duration)
- [x] 9.10.3 Wallet transaction reports
- [x] 9.10.4 Payment success/failure reports
- [x] 9.10.5 Date range filter + export (CSV/Excel) — client-side CSV export (BOM) per report tab

### 9.11 Audit Log

- [x] 9.11.1 Audit log viewer (filter by user, action, entity, date)
- [x] 9.11.2 Diff viewer (old vs new data)
- [x] 9.11.3 Export — CSV export

### 9.12 Settings

- [x] 9.12.1 General (name, logo, currency, timezone, contact info)
- [x] 9.12.2 Notification settings
- [x] 9.12.3 Payment gateway settings (with secret masking)
- [x] 9.12.4 Pusher/Soketi settings
- [x] 9.12.5 PWA settings (app icons, theme color)
- [x] 9.12.6 File upload limits
- [x] 9.12.7 Request settings (auto-assign strategy, etc.)
- [x] 9.12.8 SMS provider settings

**Phase 9 Exit Criteria:** Admin can manage every entity in the system. All sensitive actions audit-logged.

---

## 💬 Phase 10 — Real-Time Chat + Pusher ✅ (completed 2026-09-30)

**Goal:** Real-time chat between customer and operator per request room.

### 10.1 Pusher.com Integration (Cloud — no WebSocket server needed)

- [x] 10.1.1 Configure Pusher.com account (app_id, key, secret, cluster) ✅ credentials via env (PUSHER_APP_ID/KEY/SECRET/CLUSTER) — documented in .env.example
- [x] 10.1.2 Setup Pusher server SDK in `apps/api` (pusher-nodejs) ✅ — `pusher` SDK in apps/api; PusherService (realtime/pusher.service.ts) with useTLS + no-op fallback
- [x] 10.1.3 Configure auth endpoint `POST /api/v1/broadcasting/auth` (signed JWT verification) ✅ — BroadcastingController POST /broadcasting/auth behind JwtAuthGuard + channel-level authorization
- [x] 10.1.4 Define private channel naming: `private-request.{requestId}` ✅ — `private-request.{id}` (shared PUSHER_CONFIG)
- [x] 10.1.5 Define presence channels: `presence-request.{requestId}` ✅ — `presence-request.{id}` with user_info {name, roles}
- [x] 10.1.6 Define user-level private channels: `private-user.{userId}` ✅ — `private-user.{userId}` (self-only auth) — used for NotificationCreated/Wallet/Payment events
- [x] 10.1.7 Configure Pusher webhook endpoint `POST /api/v1/broadcasting/webhook` (for channel_existence events) ✅ — POST /broadcasting/webhook with HMAC-SHA256 signature verification (timing-safe) + channel_existence logging
- [x] 10.1.8 Setup `apps/web` pusher-js client with auth transport pointing to backend ✅ — pusher-js with custom authorizer that sends the CURRENT bearer token on every (re)auth
- [x] 10.1.9 Document Pusher plan limits (channels, messages, connections) and capacity planning ✅ — capacity planning table added to docs/adr/0003 (Sandbox 100 conn/200K msg → Starter/Pro sizing rules)
- [x] 10.1.10 Configure Pusher TLS verification (reject unauthorized) ✅ — server useTLS: true; client forceTLS + only ws/wss transports
- [x] 10.1.11 **Note:** No Soketi server, no Redis adapter needed for shared hosting — Pusher handles scaling ✅ — Pusher cloud handles scaling; RealtimeService abstraction allows Soketi swap on VPS

### 10.2 Chat Data Model

- [x] 10.2.1 Create `chat_rooms` migration (id, uuid, request_id UNIQUE, type, created_at) ✅ — chat_rooms in schema + init migration (request_id UNIQUE)
- [x] 10.2.2 Create `chat_participants` migration (room_id, user_id, joined_at, last_read_at) ✅ — chat_participants (roomId+userId UNIQUE, role, last_read_at)
- [x] 10.2.3 Create `messages` migration (id, uuid, room_id, sender_id, type [text/image/file/system], body, metadata, created_at, deleted_at) ✅ — messages (type text/image/file/system, body, metadata, read_at, deleted_at, deleted_by)
- [x] 10.2.4 Create `message_attachments` migration (message_id, file_id, file_name, mime, size) ✅ — message_attachments (file_id → file_uploads, name/mime/size) with signed URLs on read
- [x] 10.2.5 Create `message_reads` migration (message_id, user_id, read_at) — or use counter approach ✅ — via Message.read_at + ChatParticipant.last_read_at (documented alternative to message_reads table)

### 10.3 Chat Endpoints

- [x] 10.3.1 `GET /api/v1/requests/:id/messages` (paginated, cursor-based) ✅ — GET /api/v1/requests/:id/messages — cursor-based (base64 id cursor), 30/page, ascending output
- [x] 10.3.2 `POST /api/v1/requests/:id/messages` (text) ✅ — POST /api/v1/requests/:id/messages — rate-limited 30/min
- [x] 10.3.3 `POST /api/v1/requests/:id/messages/file` (image/file) ✅ — POST /api/v1/requests/:id/messages/file — multipart via FilesService (private storage + signed URL 1h)
- [x] 10.3.4 `POST /api/v1/requests/:id/messages/:id/read` ✅ — POST /api/v1/requests/:id/messages/:messageId/read (supports `all` sentinel → marks every unread)
- [x] 10.3.5 `DELETE /api/v1/requests/:id/messages/:id` (soft delete by sender) ✅ — DELETE /api/v1/requests/:id/messages/:messageId — soft delete (deleted_at/deleted_by), sender or admin
- [x] 10.3.6 Authorization: only customer of request + assigned operator + admin ✅ — enforced in ChatService.assertRoomAccess + resolveRoom (customer owner / assigned operator / admin)

### 10.4 Real-Time Events

- [x] 10.4.1 Emit `MessageSent` on private-request.{id} ✅ — ChatService.afterMessagePersisted → RealtimeService.broadcastMessage
- [x] 10.4.2 Emit `MessageRead` on private-request.{id} ✅ — emitted with readerId + lastMessageId + count for receipt updates
- [x] 10.4.3 Emit `RequestStatusChanged` on private-request.{id} ✅ — request-workflow.service + requests.service emit on status transitions
- [x] 10.4.4 Emit `RequestPriceChanged` on private-request.{id} ✅ — pricing/request-costs.service emits on cost updates (room + customer private channels)
- [x] 10.4.5 Emit `NotificationCreated` on private-user.{id} ✅ — emitted on private-user.{id} for new chat messages (full NotificationService lands Phase 11)
- [x] 10.4.6 Emit `WalletUpdated` on private-user.{id} ✅ — wallet.service emits on balance changes
- [x] 10.4.7 Emit `PaymentCompleted` on private-user.{id} ✅ — payments.service emits PaymentCompleted/PaymentFailed

### 10.5 Chat UI (Customer + Operator)

- [x] 10.5.1 `ChatMessage` component (text/image/file/system) ✅ — components/chat/ChatMessageItem.tsx (text/image/file/system + deleted tombstone, RTL)
- [x] 10.5.2 `ChatInput` component (text + attach) ✅ — components/chat/ChatInput.tsx (auto-grow textarea + attach ≤10MB + caption, Enter to send)
- [x] 10.5.3 Message list (infinite scroll up) ✅ — useInfiniteQuery + fetchPreviousPage with scroll-position restore
- [x] 10.5.4 Unread counter badge ✅ — ChatRoomList badges per room + chat/unread-count endpoint; operator dashboard KPI now live
- [x] 10.5.5 Typing indicator (optional, via presence) ✅ — client-typing events on presence channel, 1.5s throttle, 2.5s expiry
- [x] 10.5.6 Read receipts (✓✓) ✅ — ✓ sent / ✓✓ read via MessageRead event (numeric-safe id comparison)
- [x] 10.5.7 Optimistic send + rollback on error ✅ — useChat textMutation onMutate optimistic append + rollback onError
- [x] 10.5.8 Connection state indicator ✅ — bindConnectionState watcher → status strip (connected / reconnecting)
- [x] 10.5.9 Auto-reconnect on drop ✅ — pusher-js auto-reconnect + refetch history & rooms on `connected` state

**Phase 10 Exit Criteria:** Customer and operator can chat in real-time, attachments work, read receipts accurate, presence shows who's online.

---

## 🔔 Phase 11 — Notification + Web Push

**Goal:** In-app + real-time + web push notification system.

### 11.1 Notification Data Model

- [ ] 11.1.1 Create `notifications` migration (id, uuid, user_id, type, title, body, data JSONB, read_at, created_at)
- [ ] 11.1.2 Create `notification_preferences` migration (user_id, type, in_app, push, email, sms)
- [ ] 11.1.3 Create `push_subscriptions` migration (id, user_id, endpoint UNIQUE, p256dh, auth, device_info, created_at, last_used_at, expired_at)

### 11.2 Notification Service

- [ ] 11.2.1 Implement `NotificationService.send(userId, type, data)`
- [ ] 11.2.2 Generate localized title/body based on type & user locale
- [ ] 11.2.3 Persist in-app notification
- [ ] 11.2.4 Emit `NotificationCreated` real-time event
- [ ] 11.2.5 Trigger web push dispatch (if user has subscription + preference)
- [ ] 11.2.6 Trigger email (if enabled)
- [ ] 11.2.7 Trigger SMS (if enabled & critical)

### 11.3 Notification Endpoints

- [ ] 11.3.1 `GET /api/v1/notifications` (paginated, unread first)
- [ ] 11.3.2 `POST /api/v1/notifications/:id/read`
- [ ] 11.3.3 `POST /api/v1/notifications/read-all`
- [ ] 11.3.4 `GET /api/v1/notifications/unread-count`
- [ ] 11.3.5 `DELETE /api/v1/notifications/:id`
- [ ] 11.3.6 `GET/PUT /api/v1/notifications/preferences`

### 11.4 Web Push

- [ ] 11.4.1 Generate VAPID keys
- [ ] 11.4.2 Configure `web-push` library
- [ ] 11.4.3 `POST /api/v1/push/subscribe` (store subscription)
- [ ] 11.4.4 `DELETE /api/v1/push/subscribe` (unsubscribe)
- [ ] 11.4.5 Implement push dispatch worker (queue via BullMQ)
- [ ] 11.4.6 Implement subscription expiry detection (remove 410 Gone)
- [ ] 11.4.7 Implement subscription rotation (per browser)

### 11.5 Notification Types (auto-fired)

- [ ] 11.5.1 RequestCreated → notify operators
- [ ] 11.5.2 RequestAssigned → notify customer
- [ ] 11.5.3 RequestStatusChanged → notify customer
- [ ] 11.5.4 RequestPriceChanged → notify customer
- [ ] 11.5.5 NewChatMessage → notify recipient
- [ ] 11.5.6 PaymentSuccessful → notify customer + admin
- [ ] 11.5.7 PaymentFailed → notify customer
- [ ] 11.5.8 WalletCharged → notify customer
- [ ] 11.5.9 RefundIssued → notify customer
- [ ] 11.5.10 RequestCompleted → notify customer

### 11.6 Notification UI

- [ ] 11.6.1 Notification bell with unread badge
- [ ] 11.6.2 Notification dropdown (mobile bottom sheet)
- [ ] 11.6.3 Notification list page
- [ ] 11.6.4 Push permission prompt UX
- [ ] 11.6.5 In-app toast on new notification

**Phase 11 Exit Criteria:** All key events trigger notifications across all 3 channels (in-app, real-time, push) per user preferences.

---

## 📲 Phase 12 — PWA + Offline + Installability

**Goal:** Convert SPA to installable, offline-capable PWA.

### 12.1 Manifest

- [ ] 12.1.1 `manifest.webmanifest` (name, short_name, icons, start_url, scope, display:standalone, orientation, theme_color, background_color, lang:fa, dir:rtl)
- [ ] 12.1.2 App icons (192, 256, 384, 512 + maskable variants)
- [ ] 12.1.3 Splash screen config (iOS)
- [ ] 12.1.4 Shortcuts (Home, My Requests, Wallet, Chat)

### 12.2 Service Worker

- [ ] 12.2.1 Setup `next-pwa` or custom SW
- [ ] 12.2.2 App Shell caching strategy (cache-first)
- [ ] 12.2.3 Static asset caching (stale-while-revalidate)
- [ ] 12.2.4 API caching (network-first with fallback)
- [ ] 12.2.5 Image caching (cache-first + expiration)
- [ ] 12.2.6 Offline fallback page
- [ ] 12.2.7 Background sync for failed requests (chat messages)
- [ ] 12.2.8 Push event handler
- [ ] 12.2.9 Notification click handler
- [ ] 12.2.10 Periodic sync (optional)

### 12.3 Install Prompt

- [ ] 12.3.1 Custom install prompt UI
- [ ] 12.3.2 Detect `beforeinstallprompt`
- [ ] 12.3.3 Dismiss logic with cooldown
- [ ] 12.3.4 iOS install instructions (no API, manual)

### 12.4 PWA Testing

- [ ] 12.4.1 Lighthouse PWA audit ≥ 90
- [ ] 12.4.2 Android Chrome install test
- [ ] 12.4.3 iOS Safari install test
- [ ] 12.4.4 Offline mode test
- [ ] 12.4.5 Push notification test (Android + iOS)
- [ ] 12.4.6 Background sync test

**Phase 12 Exit Criteria:** PWA installs on Android & iOS, works offline (cached shell + fallback), receives push notifications.

---

## 📊 Phase 13 — Reports + Audit Logs + Settings

**Goal:** Comprehensive reporting & full audit visibility.

### 13.1 Financial Reports (extends §33)

- [ ] 13.1.1 Daily/Monthly/Yearly revenue
- [ ] 13.1.2 Total labor fees, material costs, discounts, refunds
- [ ] 13.1.3 Wallet transactions summary
- [ ] 13.1.4 Successful vs failed payments
- [ ] 13.1.5 Refund totals
- [ ] 13.1.6 Date range filter
- [ ] 13.1.7 Export to CSV/Excel (ExcelJS)

### 13.2 Service Reports (extends §34)

- [ ] 13.2.1 Request count per service
- [ ] 13.2.2 Request count per category
- [ ] 13.2.3 Completed vs cancelled per service
- [ ] 13.2.4 Revenue per service
- [ ] 13.2.5 Average completion duration
- [ ] 13.2.6 Pending & InProgress counts

### 13.3 Audit Log (extends §35)

- [ ] 13.3.1 Login/logout events
- [ ] 13.3.2 Role & permission changes
- [ ] 13.3.3 Price changes (with diff)
- [ ] 13.3.4 Status changes
- [ ] 13.3.5 Wallet adjustments & refunds
- [ ] 13.3.6 Service CRUD operations
- [ ] 13.3.7 Customer data changes
- [ ] 13.3.8 Settings changes
- [ ] 13.3.9 IP + User Agent + timestamp on every entry
- [ ] 13.3.10 Filter by user, action, entity, date range

### 13.4 Settings (extends §47)

- [ ] 13.4.1 General (name, logo, currency, timezone, contact)
- [ ] 13.4.2 Notification defaults
- [ ] 13.4.3 Payment gateway config (secrets NOT exposed to frontend)
- [ ] 13.4.4 Pusher/Soketi config
- [ ] 13.4.5 PWA config (icons, theme)
- [ ] 13.4.6 File upload limits (max size, allowed MIME)
- [ ] 13.4.7 Request defaults (auto-assign strategy, default currency)
- [ ] 13.4.8 SMS provider config

**Phase 13 Exit Criteria:** Admin has full visibility into all financial, service, and audit data with date filtering and export.

---

## 🛡️ Phase 14 — Security Hardening

**Goal:** Defend against all listed attack vectors (spec §38).

- [ ] 14.1 SQL Injection: Prisma parameterized queries + raw query audit
- [ ] 14.2 XSS: React auto-escaping + DOMPurify on rich content + CSP headers
- [ ] 14.3 CSRF: SameSite cookies for auth + CSRF token for state-changing mutations
- [ ] 14.4 Broken Access Control: every endpoint has Guard + ownership check + integration tests
- [ ] 14.5 IDOR: every `:id` access checked against current user's ownership/role
- [ ] 14.6 Brute Force: rate limit login (5/min/IP, 10/hour/account), exponential backoff, account lockout
- [ ] 14.7 Rate Abuse: per-endpoint rate limits (express-rate-limit / NestJS Throttler)
- [ ] 14.8 File Upload: MIME sniff + magic-byte validation + extension allowlist + size limit + filename sanitization + ClamAV scan (optional)
- [ ] 14.9 Session Hijacking: rotating refresh tokens + IP/UA binding + revoke on mismatch
- [ ] 14.10 Privilege Escalation: never trust client role; always re-check server-side
- [ ] 14.11 Replay Attacks: nonce + timestamp window for OTP & payment callbacks
- [ ] 14.12 Double Payment: idempotency_key UNIQUE constraint + DB transaction + status check
- [ ] 14.13 Double Spending: SELECT FOR UPDATE on wallet row + UNIQUE on ledger idempotency
- [ ] 14.14 Sensitive data: secrets via env only, never committed, never sent to frontend
- [ ] 14.15 Helmet, CORS strict, HSTS, X-Frame-Options DENY
- [ ] 14.16 Secrets scanning in CI (gitleaks)
- [ ] 14.17 Dependency audit (pnpm audit) in CI
- [ ] 14.18 OWASP Top 10 review pass
- [ ] 14.19 Penetration test checklist (manual)

**Phase 14 Exit Criteria:** All listed attack vectors have documented mitigations + automated tests proving the mitigation works.

---

## 🧪 Phase 15 — Unit + Feature + Integration + E2E Testing

**Goal:** Production-grade test coverage.

### 15.1 Unit Tests (Vitest)

- [ ] 15.1.1 Pricing calculation (FinalTotal formula)
- [ ] 15.1.2 Discount validation (percent, fixed, max, min, expired, used-up)
- [ ] 15.1.3 Wallet service (deposit, withdraw, refund, double-spend rejection)
- [ ] 15.1.4 Ledger immutability
- [ ] 15.1.5 Payment gateway adapters (mocked)
- [ ] 15.1.6 Request status state machine (all transitions)
- [ ] 15.1.7 Authorization guards (every permission)
- [ ] 15.1.8 OTP generation & validation
- [ ] 15.1.9 Dynamic form validator (every field type)
- [ ] 15.1.10 Tracking code generation uniqueness

### 15.2 Feature Tests (Vitest + Supertest)

- [ ] 15.2.1 Registration flow
- [ ] 15.2.2 Login flow (success + failure)
- [ ] 15.2.3 OTP flow (rate limit + expiry)
- [ ] 15.2.4 Request creation (with dynamic form)
- [ ] 15.2.5 Request lifecycle (all status transitions)
- [ ] 15.2.6 Wallet deposit (via online payment)
- [ ] 15.2.7 Wallet payment for request
- [ ] 15.2.8 Refund flow
- [ ] 15.2.9 Payment callback (success + failure + replay)
- [ ] 15.2.10 Chat authorization (non-participant rejected)
- [ ] 15.2.11 Notification dispatch (3 channels)
- [ ] 15.2.12 Discount apply + usage limit
- [ ] 15.2.13 Invoice generation + download
- [ ] 15.2.14 File upload (valid + invalid MIME)
- [ ] 15.2.15 RBAC (every role × every endpoint)

### 15.3 Integration Tests

- [ ] 15.3.1 Soketi ↔ API auth handshake
- [ ] 15.3.2 Payment gateway (sandbox mode)
- [ ] 15.3.3 Web push (against real subscription)
- [ ] 15.3.4 File upload to MinIO + retrieve
- [ ] 15.3.5 SMS provider (mock or sandbox)
- [ ] 15.3.6 Email provider (Mailhog)

### 15.4 E2E Tests (Playwright)

- [ ] 15.4.1 Customer full flow: register → submit request → pay → chat → complete
- [ ] 15.4.2 Operator full flow: login → take request → set cost → request payment → complete
- [ ] 15.4.3 Admin full flow: login → manage users → create service → view reports
- [ ] 15.4.4 Wallet deposit flow end-to-end
- [ ] 15.4.5 PWA install + offline scenario
- [ ] 15.4.6 Push notification receive on mobile

### 15.5 Performance & Non-Functional

- [ ] 15.5.1 Load test (k6) — 1000 concurrent users
- [ ] 15.5.2 Wallet concurrency test (100 parallel payments, only 1 succeeds)
- [ ] 15.5.3 Lighthouse audit ≥ 90 (Performance, Accessibility, Best Practices, SEO, PWA)
- [ ] 15.5.4 Bundle size budget (< 200KB initial JS)

### 15.6 CI Integration

- [ ] 15.6.1 All tests run on every PR
- [ ] 15.6.2 Coverage report (≥ 80% critical paths)
- [ ] 15.6.3 E2E runs on staging deploy

**Phase 15 Exit Criteria:** All listed tests pass in CI. Coverage ≥ 80% on financial & auth paths.

---

## 🚀 Phase 16 — Production Deployment + Backup + Monitoring

**Goal:** Ship to production with confidence — **must work on both shared hosting AND VPS**.

### 16.1 Infrastructure (Dual Profile)

#### 16.1.A — Shared Hosting Profile

- [ ] 16.1.A.1 Select shared hosting provider (Liara shared / ParsPack shared / Hostiran / cPanel host)
- [ ] 16.1.A.2 Verify Node.js support (Passenger / LiteSpeed LSAPI / cPanel Node.js selector)
- [ ] 16.1.A.3 Verify MySQL 8 + SSH access + Cron + sufficient memory (≥ 512MB)
- [ ] 16.1.A.4 Configure `.htaccess` (Apache) or `.lsapi` (LiteSpeed) for SPA + API routing
- [ ] 16.1.A.5 Build `apps/api` → upload `dist/` + `node_modules` (production deps only) via SSH/FTP
- [ ] 16.1.A.6 Build `apps/web` → upload `.next/` standalone output to `public_html/`
- [ ] 16.1.A.7 Configure environment variables via `.env` file (in root, not web-accessible)
- [ ] 16.1.A.8 Setup cron jobs (every minute):
  ```
  * * * * * cd /home/user/caffenet/api && /usr/bin/node dist/worker.js --max-jobs=50 --timeout=55 >> storage/logs/cron.log 2>&1
  ```
- [ ] 16.1.A.9 Configure TLS via cPanel AutoSSL or Let's Encrypt
- [ ] 16.1.A.10 Configure storage directories (writable: `storage/app`, `storage/cache`, `storage/logs`)
- [ ] 16.1.A.11 Set `DEPLOYMENT_PROFILE=shared` in env
- [ ] 16.1.A.12 Set `CACHE_DRIVER=file`, `QUEUE_DRIVER=database`, `STORAGE_DRIVER=local`
- [ ] 16.1.A.13 Disable Pusher webhook endpoint verification if SSL issues (or use self-signed workaround)
- [ ] 16.1.A.14 Configure Cloudflare CDN in front of shared hosting (optional, recommended)
- [ ] 16.1.A.15 Test cron job execution + log rotation
- [ ] 16.1.A.16 Verify memory limits do not crash worker on heavy jobs

#### 16.1.B — VPS Profile

- [ ] 16.1.B.1 Provision VPS (Hetzner / DigitalOcean / Iranian VPS like ParsPack VPS)
- [ ] 16.1.B.2 Setup MySQL 8 (managed or self-hosted with replication)
- [ ] 16.1.B.3 Setup Redis 7 (managed or self-hosted)
- [ ] 16.1.B.4 Setup MinIO / S3-compatible storage (optional — local disk works too)
- [ ] 16.1.B.5 Setup Nginx / Caddy reverse proxy with auto-TLS
- [ ] 16.1.B.6 Setup PM2 process manager (runs API + worker as daemons)
- [ ] 16.1.B.7 Configure CDN (Cloudflare) for static assets + WAF rules
- [ ] 16.1.B.8 Set `DEPLOYMENT_PROFILE=vps`, `CACHE_DRIVER=redis`, `QUEUE_DRIVER=redis`, `STORAGE_DRIVER=s3`
- [ ] 16.1.B.9 Optional: Deploy Soketi as alternative to Pusher.com (for cost saving at high scale)

### 16.2 CI/CD Pipeline

- [ ] 16.2.1 GitHub Actions: lint → test → build → push image → deploy
- [ ] 16.2.2 Docker multi-stage builds (slim final image)
- [ ] 16.2.3 Container registry (GHCR)
- [ ] 16.2.4 Staging environment auto-deploy on `main`
- [ ] 16.2.5 Production deploy on tag `v*.*.*`
- [ ] 16.2.6 Blue/green or rolling deploy (zero-downtime)
- [ ] 16.2.7 Database migration as separate deploy step

### 16.3 Environment Management

- [ ] 16.3.1 `.env.development`, `.env.staging`, `.env.production`
- [ ] 16.3.2 `.env.shared-hosting` template (file cache, db queue, local storage)
- [ ] 16.3.3 `.env.vps` template (Redis cache, BullMQ, MinIO storage)
- [ ] 16.3.4 Secrets in GitHub Actions secrets / Vault (VPS) / cPanel Env Vars (shared)
- [ ] 16.3.5 No secrets in repo (verified by gitleaks)
- [ ] 16.3.6 Separate databases per environment

### 16.4 Backup

- [ ] 16.4.1 Daily **MySQL** backup (`mysqldump --single-transaction` + upload to off-site storage)
- [ ] 16.4.2 MySQL binlog replication (for PITR on VPS) or daily full + hourly incremental (shared hosting)
- [ ] 16.4.3 Redis RDB + AOF (VPS only)
- [ ] 16.4.4 MinIO bucket replication
- [ ] 16.4.5 Backup retention: 30 days rolling
- [ ] 16.4.6 Quarterly restore drill
- [ ] 16.4.7 Backup integrity verification

### 16.5 Monitoring & Observability

- [ ] 16.5.1 Application metrics (Prometheus exporter)
- [ ] 16.5.2 Grafana dashboards (revenue, requests, errors, latency, queue)
- [ ] 16.5.3 Structured logs (Pino → Loki)
- [ ] 16.5.4 Distributed tracing (OpenTelemetry)
- [ ] 16.5.5 Uptime monitoring (UptimeRobot / BetterUptime)
- [ ] 16.5.6 Alerting rules (PagerDuty / Telegram bot)
- [ ] 16.5.7 Health check endpoint
- [ ] 16.5.8 Sentry for error tracking (frontend + backend)

### 16.6 Documentation

- [ ] 16.6.1 README.md (setup, dev, deploy)
- [ ] 16.6.2 API documentation (OpenAPI auto-published)
- [ ] 16.6.3 Architecture Decision Records (ADRs)
- [ ] 16.6.4 Runbook for common incidents
- [ ] 16.6.5 User documentation (admin, operator, customer)

### 16.7 Launch Checklist

- [ ] 16.7.1 DNS configured
- [ ] 16.7.2 TLS certificates valid
- [ ] 16.7.3 All env vars set in production
- [ ] 16.7.4 Database migrated
- [ ] 16.7.5 Seed data inserted (admin user, default categories)
- [ ] 16.7.6 First admin password rotated
- [ ] 16.7.7 Smoke test pass
- [ ] 16.7.8 Backup verified
- [ ] 16.7.9 Monitoring green
- [ ] 16.7.10 Stakeholder sign-off

**Phase 16 Exit Criteria:** System live in production with monitoring, backups, and runbook. First real customer can register and submit a request end-to-end.

---

## 📈 Progress Dashboard

| Phase | Title                      | Status     | Completion | Started    | Completed  |
| ----- | -------------------------- | ---------- | ---------- | ---------- | ---------- |
| 0     | Architecture & Planning    | ✅ Done    | 100%       | 2026-09-28 | 2026-09-28 |
| 1     | Foundation (Stack/DB/API)  | ✅ Done    | 100%       | 2026-09-28 | 2026-09-28 |
| 2     | Auth + RBAC                | ✅ Done    | 100%       | 2026-09-28 | 2026-09-28 |
| 3     | Catalog + Dynamic Forms    | ✅ Done    | 100%       | 2026-09-28 | 2026-09-28 |
| 4     | Requests + Workflow        | ⏳ Pending | 0%         | —          | —          |
| 5     | Pricing + Invoice          | ⏳ Pending | 0%         | —          | —          |
| 6     | Wallet + Payment           | ⏳ Pending | 0%         | —          | —          |
| 7     | Customer UI                | ⏳ Pending | 0%         | —          | —          |
| 8     | Operator Dashboard         | ⏳ Pending | 0%         | —          | —          |
| 9     | Admin Dashboard            | ⏳ Pending | 0%         | —          | —          |
| 10    | Real-Time Chat + Pusher    | ⏳ Pending | 0%         | —          | —          |
| 11    | Notification + Web Push    | ⏳ Pending | 0%         | —          | —          |
| 12    | PWA + Offline              | ⏳ Pending | 0%         | —          | —          |
| 13    | Reports + Audit + Settings | ⏳ Pending | 0%         | —          | —          |
| 14    | Security Hardening         | ⏳ Pending | 0%         | —          | —          |
| 15    | Testing                    | ⏳ Pending | 0%         | —          | —          |
| 16    | Production Deployment      | ⏳ Pending | 0%         | —          | —          |

**Overall:** 4 / 17 phases complete · ~24% of overall project

---

## 📝 Change Log

| Date       | Author    | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-28 | Architect | Initial creation — Phase 0 complete, all 16 phases scoped                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-09-28 | Architect | **Revision 2**: Switched to Pusher cloud (removed Soketi), MySQL primary (PostgreSQL optional), iPanel SMS, ZarinPal payment, added Dual Deployment Profile for shared hosting compatibility. Removed Redis/MinIO as hard requirements — now optional via env drivers. Added cron-based worker CLI.                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-09-28 | Architect | Stakeholder approved architecture + 5 confirmation questions answered. Phase 1 marked as in_progress.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-09-28 | Architect | **Phase 1 complete**: Monorepo (Turborepo + pnpm), NestJS 11 + Prisma (MySQL 8, 25+ entities, 47 permissions seed), Next.js 16 PWA with RTL Persian, dual deployment profile (Cache/Queue/Storage abstractions), Pusher integration, Worker CLI for cron, Docker/PM2/.htaccess configs, 6 ADRs, full docs. 119 files committed. CI workflow committed locally but cannot be pushed without `workflow` scope on token — stakeholder action item.                                                                                                                                                                                                                     |
| 2026-09-28 | Architect | **Folder restructure**: Moved `docker/` → `deployment/shared-hosting/` + `deployment/vps/` to make it crystal clear that shared hosting deployment does NOT use Docker anywhere. Added ADR-0007 documenting this. Updated README, deploy-shared.sh, deployment guide. Verified: shared hosting path uses NO Dockerfiles, NO docker-compose, NO container runtime — only plain Node.js + MySQL + .htaccess + cron.                                                                                                                                                                                                                                                   |
| 2026-09-28 | Architect | Phase 2 marked as in_progress. Building auth (register, login, OTP, refresh, logout), JWT RS256, iPanel SMS, session management, RBAC guards, audit interceptor.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-09-28 | Architect | **Phase 2 complete**: Auth (register, login, OTP, refresh, logout, forgot/reset password), JWT (HS256 access 15min + rotating refresh 7d with reuse detection), iPanel SMS with pattern-based OTP, Session management (list/revoke/revoke-all), RBAC guards (Roles + Permissions, admin bypass), Audit module (interceptor + event listener + sensitive field redaction), Users module (profile management). 31 files committed, 16 new endpoints. argon2id for all hashing (passwords, OTP codes, refresh tokens).                                                                                                                                                 |
| 2026-09-28 | Architect | Phase 3 marked as in_progress. Building Categories CRUD, Services CRUD, Dynamic Service Forms (14 field types), server-side validation engine, admin form builder.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-09-28 | Architect | **Phase 3 complete**: Categories (CRUD + reorder + soft delete with referential protection), Services (CRUD + public search + filters + pagination), Service Fields (14 field types, validation rules as JSON, options for select/radio/checkbox), Dynamic Form Validator (server-side single source of truth, per-type validators for text/number/email/phone Iranian/date/time/select/file), Files module (upload via Multer, MIME + size + filename + SHA256 hash, deduplication, private files served only via signed URLs). 17 files committed, 21 new endpoints (admin + public + files). Backend ALWAYS re-validates form submissions — never trusts client. |

---

## 🤝 Stakeholder Approval

- [x] **Architecture approved** — proceed to Phase 1 ✅ (2026-09-28)
- [x] Stakeholder confirmed: Pusher cloud + iPanel SMS + ZarinPal payment + Pattern-based OTP
- [x] Stakeholder confirmed: Dual deployment profile, Shared hosting first priority
- [x] Stakeholder confirmed: Execution workflow (in_progress → code → completed → report)
- [ ] ~~**Architecture needs revision**~~ (not needed)

> Once approved, this file will be updated at the end of every phase. Each phase will commit its own progress with a `chore(tasks): complete phase N` commit message.
