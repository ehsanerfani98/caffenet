# ☕ Caffenet - Production-Ready Internet Cafe Service Platform

> **Document Type:** Master Task Tracker  
> **Project:** Caffenet — Internet Cafe Service Management Platform  
> **Owner:** Senior Software Architect Team  
> **Repository:** [ehsanerfani98/caffenet](https://github.com/ehsanerfani98/caffenet)  
> **Created:** 2026-09-28  
> **Status:** Architecture Revised — Pending Final Approval  
> **Last Updated:** 2026-09-28 (revision 2 — shared hosting compatibility)

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

| # | Original | Updated | Reason |
|---|----------|---------|--------|
| 1 | PostgreSQL primary | **MySQL 8 primary** (PostgreSQL optional for VPS) | Shared hosting compatibility — most Iranian shared hosts only offer MySQL/MariaDB |
| 2 | Redis required | **Redis optional** — File-based cache + Database queue by default | Shared hosting does not provide Redis |
| 3 | Self-hosted Soketi | **Pusher.com (cloud)** | Stakeholder preference; also removes need for WebSocket server (compatible with shared hosting) |
| 4 | MinIO required | **Local filesystem by default** (MinIO/S3 optional) | Shared hosting has local storage; MinIO not installable |
| 5 | Kavenegar SMS | **iPanel SMS** | Stakeholder preference |
| 6 | BullMQ queue | **Database-backed queue** by default (BullMQ optional for VPS) | Shared hosting cannot run long-running worker processes |
| 7 | Docker-only deployment | **Dual deployment profile** (Shared hosting + VPS) | Stakeholder requirement: must work on shared hosting |
| 8 | PM2 long-running worker | **Cron-based worker** (`node dist/worker.js` every minute) for shared | Shared hosting only allows cron-based scheduling |

**Result:** The system now supports **two deployment profiles**:
- 🏠 **Shared Hosting Profile** — file cache, DB queue, local storage, cron worker, Pusher cloud
- 🚀 **VPS Profile** — Redis cache, BullMQ queue, MinIO storage, PM2 worker, Pusher cloud (or Soketi optional)

---

## 🏗️ Phase 0 — Architecture & Planning

| ID | Task | Status | Notes |
|----|------|--------|-------|
| 0.1 | Stack proposal & rationale | ✅ | Next.js 16 + NestJS + MySQL 8 + Pusher cloud + iPanel + ZarinPal |
| 0.2 | Architecture document (22 sections) | ✅ | Delivered to stakeholder |
| 0.2.1 | Architecture revision (shared hosting compatibility) | ✅ | Dual deployment profile designed |
| 0.3 | GitHub repository initialization | ✅ | `ehsanerfani98/caffenet` |
| 0.4 | TASKS.md master tracker (v2) | ✅ | Updated with revision log |
| 0.5 | Stakeholder approval to start Phase 1 | ⏳ | **Awaiting final confirmation** |

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
- [ ] 2.1.1 Create `users` table migration (id, uuid, phone, email, password_hash, full_name, status, etc.)
- [ ] 2.1.2 Create `roles` table (id, name, slug, description)
- [ ] 2.1.3 Create `permissions` table (id, name, slug, group)
- [ ] 2.1.4 Create `role_permissions` join table
- [ ] 2.1.5 Create `user_roles` join table
- [ ] 2.1.6 Seed 3 roles: customer, operator, admin
- [ ] 2.1.7 Seed granular permissions (services.view, requests.create, wallet.adjust, etc.)
- [ ] 2.1.8 Map default permissions to roles

### 2.2 Authentication Core
- [ ] 2.2.1 Implement password hashing (bcrypt, cost=12)
- [ ] 2.2.2 Implement JWT access token (15min, RS256)
- [ ] 2.2.3 Implement refresh token (7d, rotating, hashed in DB)
- [ ] 2.2.4 Implement `POST /api/v1/auth/register`
- [ ] 2.2.5 Implement `POST /api/v1/auth/login` (phone or email)
- [ ] 2.2.6 Implement `POST /api/v1/auth/logout` (revoke refresh)
- [ ] 2.2.7 Implement `POST /api/v1/auth/refresh`
- [ ] 2.2.8 Implement `POST /api/v1/auth/forgot-password`
- [ ] 2.2.9 Implement `POST /api/v1/auth/reset-password`
- [ ] 2.2.10 Implement `POST /api/v1/auth/verify-otp`
- [ ] 2.2.11 Implement `POST /api/v1/auth/resend-otp`

### 2.3 OTP & Anti-Abuse
- [ ] 2.3.1 Create `otps` table (id, user_id, code_hash, type, expires_at, consumed_at, attempts)
- [ ] 2.3.2 Implement OTP generation (6-digit, hashed storage)
- [ ] 2.3.3 Implement rate limiting per phone (max 3/hour, max 5/day) — DB-based for shared hosting compat
- [ ] 2.3.4 Implement attempt limit (max 5 wrong tries)
- [ ] 2.3.5 Implement OTP expiration (2 minutes)
- [ ] 2.3.6 Integrate **iPanel SMS provider** (configurable, with API key from env)
- [ ] 2.3.7 Integrate email OTP fallback (SMTP)
- [ ] 2.3.8 Implement `SmsGateway` interface with two adapters: `ipanel` (default) + `kavenegar` (optional)
- [ ] 2.3.9 Use iPanel pattern-based SMS (verification codes via pattern)

### 2.4 Session & Device Management
- [ ] 2.4.1 Create `sessions` table (id, user_id, refresh_token_hash, user_agent, ip, last_used, expires_at)
- [ ] 2.4.2 Implement `GET /api/v1/auth/sessions`
- [ ] 2.4.3 Implement `DELETE /api/v1/auth/sessions/:id`
- [ ] 2.4.4 Implement `DELETE /api/v1/auth/sessions` (revoke all except current)
- [ ] 2.4.5 Detect device fingerprint (UA + IP)

### 2.5 Authorization Guards
- [ ] 2.5.1 Implement `@Public()` decorator
- [ ] 2.5.2 Implement `@Roles()` decorator + RolesGuard
- [ ] 2.5.3 Implement `@Permissions()` decorator + PermissionsGuard
- [ ] 2.5.4 Implement `@CurrentUser()` param decorator
- [ ] 2.5.5 Implement `@OwnerOrPermission()` resource ownership check

### 2.6 Audit Foundation
- [ ] 2.6.1 Create `audit_logs` table
- [ ] 2.6.2 Implement `AuditLogInterceptor`
- [ ] 2.6.3 Auto-log: login, logout, role/permission changes, password changes

**Phase 2 Exit Criteria:** A user can register, login, receive OTP, refresh token, view sessions, revoke sessions. Admin can assign roles/permissions. All actions audit-logged.

---

## 🗂️ Phase 3 — Categories + Services + Dynamic Forms

**Goal:** Build the service catalog with admin-defined dynamic form schemas.

### 3.1 Categories
- [ ] 3.1.1 Create `categories` migration (id, uuid, name, slug, description, icon, image, sort_order, active, timestamps)
- [ ] 3.1.2 Implement `POST /api/v1/admin/categories` (admin only)
- [ ] 3.1.3 Implement `GET /api/v1/admin/categories` (with pagination)
- [ ] 3.1.4 Implement `GET /api/v1/categories` (public, active only, sorted)
- [ ] 3.1.5 Implement `GET /api/v1/categories/:slug` (with services)
- [ ] 3.1.6 Implement `PATCH /api/v1/admin/categories/:id`
- [ ] 3.1.7 Implement `PATCH /api/v1/admin/categories/:id/reorder`
- [ ] 3.1.8 Implement `DELETE /api/v1/admin/categories/:id` (soft delete)
- [ ] 3.1.9 Implement image upload (Multer + MinIO)
- [ ] 3.1.10 Seed default categories

### 3.2 Services
- [ ] 3.2.1 Create `services` migration (full schema from spec §5)
- [ ] 3.2.2 Implement admin CRUD endpoints
- [ ] 3.2.3 Implement public read endpoints (active only)
- [ ] 3.2.4 Implement `GET /api/v1/services/:slug` (with fields + category)
- [ ] 3.2.5 Implement search (`GET /api/v1/services?q=...`)
- [ ] 3.2.6 Implement filter by category, price range, duration
- [ ] 3.2.7 Implement pagination (cursor-based for performance)
- [ ] 3.2.8 Seed sample services

### 3.3 Dynamic Service Forms
- [ ] 3.3.1 Create `service_fields` migration (service_id, label, name, type, placeholder, help_text, required, validation_rules JSONB, default_value, sort_order, options JSONB)
- [ ] 3.3.2 Create `service_field_options` migration (for select/radio/checkbox)
- [ ] 3.3.3 Implement admin UI to build forms (drag-drop builder)
- [ ] 3.3.4 Implement field type support: text, textarea, number, email, phone, date, time, datetime, select, multiselect, radio, checkbox, file, image
- [ ] 3.3.5 Implement validation rule schema (JSONB with type, params, message)
- [ ] 3.3.6 Implement server-side dynamic validation engine
- [ ] 3.3.7 Implement client-side `DynamicForm` renderer component
- [ ] 3.3.8 Implement conditional field visibility rules
- [ ] 3.3.9 Implement file/image field integration with uploader

**Phase 3 Exit Criteria:** Admin can build category → service → dynamic form. Customer can browse and view forms. Forms validate both client & server side.

---

## 📝 Phase 4 — Request Management + Status Workflow

**Goal:** Complete request lifecycle with status machine, history tracking, assignments.

### 4.1 Request Core
- [ ] 4.1.1 Create `requests` migration (full schema §9)
- [ ] 4.1.2 Create `request_field_values` migration
- [ ] 4.1.3 Create `request_status_histories` migration
- [ ] 4.1.4 Create `request_assignments` migration
- [ ] 4.1.5 Generate tracking code (e.g. `CF-2026-001234`)
- [ ] 4.1.6 Generate UUID per request
- [ ] 4.1.7 Implement `POST /api/v1/requests` (customer creates)
- [ ] 4.1.8 Implement `GET /api/v1/requests` (customer: own; operator/admin: filtered)
- [ ] 4.1.9 Implement `GET /api/v1/requests/:trackingCode` (customer lookup)
- [ ] 4.1.10 Implement `GET /api/v1/requests/:id` (authorized)
- [ ] 4.1.11 Implement `PATCH /api/v1/requests/:id/cancel` (customer, with rules)
- [ ] 4.1.12 Implement request file attachments endpoint

### 4.2 Status Workflow Engine
- [ ] 4.2.1 Define status enum (Pending, Reviewing, WaitingForCustomer, InProgress, WaitingForPayment, Paid, Completed, Cancelled, Rejected)
- [ ] 4.2.2 Implement state machine (allowed transitions)
- [ ] 4.2.3 Implement `PATCH /api/v1/operator/requests/:id/status`
- [ ] 4.2.4 Auto-record status history entry on transition
- [ ] 4.2.5 Implement notes field per transition
- [ ] 4.2.6 Implement validation against allowed transitions
- [ ] 4.2.7 Emit `RequestStatusChanged` event (Pusher)

### 4.3 Assignment
- [ ] 4.3.1 Implement `POST /api/v1/operator/requests/:id/assign` (self or by admin)
- [ ] 4.3.2 Implement `POST /api/v1/admin/requests/:id/assign` (force-assign)
- [ ] 4.3.3 Implement unassign + reassign logic
- [ ] 4.3.4 Emit `RequestAssigned` event
- [ ] 4.3.5 Auto-assign strategy (round-robin, least-load) — configurable

### 4.4 Request Timeline / History API
- [ ] 4.4.1 Implement `GET /api/v1/requests/:id/history`
- [ ] 4.4.2 Implement `GET /api/v1/requests/:id/timeline` (UI-friendly)
- [ ] 4.4.3 Implement `RequestTimeline` React component

**Phase 4 Exit Criteria:** Customer can submit a request with dynamic form data → status transitions enforced server-side → full history recorded → events fired.

---

## 💰 Phase 5 — Pricing + Material Costs + Discounts + Invoice

**Goal:** Complete financial pricing layer, immutable price audit, discounts, invoice generation.

### 5.1 Pricing Snapshot
- [ ] 5.1.1 Create `request_costs` migration (request_id, labor_fee, material_cost, additional_cost, discount_amount, final_total, currency, snapshot_of_service_at_creation)
- [ ] 5.1.2 Create `request_cost_histories` migration (every change: previous, new, type, user, reason, timestamp)
- [ ] 5.1.3 Snapshot service price at request creation
- [ ] 5.1.4 Implement all amounts as INTEGER (minor units, e.g. تومان × 100)
- [ ] 5.1.5 Implement currency helper class (format, parse, convert)

### 5.2 Cost Management
- [ ] 5.2.1 Implement `PATCH /api/v1/operator/requests/:id/costs` (operator sets material + additional)
- [ ] 5.2.2 Implement permission-gated discount application
- [ ] 5.2.3 Implement `FinalTotal = Labor + Material + Additional - Discount` server-side
- [ ] 5.2.4 Reject negative final total
- [ ] 5.2.5 Auto-record cost history entries
- [ ] 5.2.6 Emit `RequestPriceChanged` event
- [ ] 5.2.7 Implement `PriceBreakdown` React component

### 5.3 Discount System
- [ ] 5.3.1 Create `discount_codes` migration (code, type [percent/fixed], value, min_order, max_discount, usage_limit, used_count, starts_at, expires_at, active)
- [ ] 5.3.2 Create `discount_usages` migration (discount_id, request_id, user_id, amount_saved, used_at)
- [ ] 5.3.3 Implement `POST /api/v1/discounts/validate` (preview discount)
- [ ] 5.3.4 Implement `POST /api/v1/discounts/apply` (lock to request)
- [ ] 5.3.5 Implement admin CRUD for discounts
- [ ] 5.3.6 Implement usage limit + expiration checks
- [ ] 5.3.7 Implement per-user usage limit
- [ ] 5.3.8 Atomic usage increment (SELECT FOR UPDATE)

### 5.4 Invoice Generation
- [ ] 5.4.1 Create `invoices` migration (invoice_number unique, customer_id, request_id, all cost fields, payment_status, timestamps)
- [ ] 5.4.2 Create `invoice_items` migration (line items: labor, material, additional, discount)
- [ ] 5.4.3 Implement auto-generate invoice when request enters WaitingForPayment
- [ ] 5.4.4 Implement `GET /api/v1/invoices/:id`
- [ ] 5.4.5 Implement `GET /api/v1/invoices/:id/download` (PDF via PDFKit / Recharts)
- [ ] 5.4.6 Implement `InvoiceCard` React component

**Phase 5 Exit Criteria:** Operator can register material costs, apply discounts (permission-gated), invoice auto-generated, all changes audited server-side, no float math anywhere.

---

## 👛 Phase 6 — Wallet + Ledger + Online Payment

**Goal:** Complete financial engine: atomic wallet, immutable ledger, online payment with verified callback.

### 6.1 Wallet
- [ ] 6.1.1 Create `wallets` migration (id, uuid, user_id UNIQUE, balance INT, currency, status, timestamps)
- [ ] 6.1.2 Auto-create wallet on user registration (DB trigger or app event)
- [ ] 6.1.3 Implement `GET /api/v1/wallet`
- [ ] 6.1.4 Implement `GET /api/v1/wallet/transactions` (paginated)
- [ ] 6.1.5 Implement `WalletBalance` React component

### 6.2 Ledger (Wallet Transactions)
- [ ] 6.2.1 Create `wallet_transactions` migration (id, uuid, wallet_id, user_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, status, idempotency_key UNIQUE, timestamps)
- [ ] 6.2.2 Implement ledger entry service (atomic with wallet update)
- [ ] 6.2.3 Implement types: Deposit, Withdrawal, ServicePayment, Refund, Discount, Bonus, ManualAdjustment, PaymentReversal
- [ ] 6.2.4 Implement idempotency key enforcement (UNIQUE constraint)
- [ ] 6.2.5 Implement `TransactionItem` React component

### 6.3 Atomic Wallet Operations
- [ ] 6.3.1 Implement `WalletService.deposit(amount, reference)` — uses DB transaction + SELECT FOR UPDATE on wallet row
- [ ] 6.3.2 Implement `WalletService.withdraw(amount, reference)` — rejects if balance insufficient
- [ ] 6.3.3 Implement `WalletService.payForRequest(requestId)` — atomic debit + ledger + request status update
- [ ] 6.3.4 Implement `WalletService.refund(requestId)` — atomic credit + reverse ledger
- [ ] 6.3.5 Implement double-spend protection (UNIQUE on idempotency_key)
- [ ] 6.3.6 Implement concurrency test (10 parallel payments, only 1 succeeds)
- [ ] 6.3.7 Implement `WalletUpdated` event

### 6.4 Online Payment Gateway
- [ ] 6.4.1 Create `payments` migration (id, uuid, user_id, wallet_id NULL, request_id NULL, amount, gateway, authority, reference_number, status, metadata JSONB, idempotency_key, timestamps, paid_at)
- [ ] 6.4.2 Create `payment_callbacks` migration (log all gateway callbacks raw)
- [ ] 6.4.3 Implement ZarinPal gateway adapter (configurable)
- [ ] 6.4.4 Implement Zibal gateway adapter (alternative)
- [ ] 6.4.5 Implement `PaymentGateway` interface (create, verify, refund)
- [ ] 6.4.6 Implement `POST /api/v1/payments` (create payment request → return authority + redirect URL)
- [ ] 6.4.7 Implement `GET /api/v1/payments/:id`
- [ ] 6.4.8 Implement `GET /api/v1/payments/callback` (verify with gateway server-side, NEVER trust client)
- [ ] 6.4.9 Implement idempotent verify (re-callback safe)
- [ ] 6.4.10 Implement `POST /api/v1/payments/:id/verify` (manual re-verify)
- [ ] 6.4.11 On success: atomic ledger deposit + wallet balance update + `PaymentCompleted` event
- [ ] 6.4.12 On failure: log + status update + `PaymentFailed` event

### 6.5 Request Payment Flow
- [ ] 6.5.1 Implement `POST /api/v1/requests/:id/pay` (choose method: wallet | online)
- [ ] 6.5.2 Wallet path: atomic wallet debit + request marked Paid
- [ ] 6.5.3 Online path: create payment → redirect → callback verify → atomic ledger
- [ ] 6.5.4 Reject double payment (idempotency + status check)
- [ ] 6.5.5 Reject if request not in WaitingForPayment

**Phase 6 Exit Criteria:** Wallet atomic, ledger immutable, online payment verified server-side, double-spend impossible (proven by test), callback idempotent.

---

## 📱 Phase 7 — Customer UI

**Goal:** Mobile-first, native-like PWA UI for customers.

### 7.1 App Shell
- [ ] 7.1.1 Setup Next.js 16 App Router
- [ ] 7.1.2 Configure RTL (`dir="rtl" lang="fa"`)
- [ ] 7.1.3 Configure Vazirmatn font (Persian)
- [ ] 7.1.4 Configure Tailwind 4 + shadcn/ui
- [ ] 7.1.5 Configure theme tokens (color, spacing, typography, radius)
- [ ] 7.1.6 Configure dark mode
- [ ] 7.1.7 Setup Zustand stores (auth, ui, cart-like request draft)
- [ ] 7.1.8 Setup TanStack Query client
- [ ] 7.1.9 Setup Axios instance with interceptors (auth, refresh, error normalization)
- [ ] 7.1.10 Setup react-i18next (fa primary, en secondary)

### 7.2 Customer Layout & Navigation
- [ ] 7.2.1 `BottomNavigation` (خانه، خدمات، درخواست‌ها، چت، پروفایل)
- [ ] 7.2.2 `MobileHeader` (with notification bell + wallet balance)
- [ ] 7.2.3 Safe area insets (`env(safe-area-inset-*)`)
- [ ] 7.2.4 Pull-to-refresh hook
- [ ] 7.2.5 Bottom Sheet component (Radix)
- [ ] 7.2.6 Full-screen Modal component
- [ ] 7.2.7 Snackbar / Toast system
- [ ] 7.2.8 Skeleton loaders
- [ ] 7.2.9 Empty states
- [ ] 7.2.10 Error states

### 7.3 Auth Pages
- [ ] 7.3.1 Login page (phone/email + password)
- [ ] 7.3.2 Register page
- [ ] 7.3.3 OTP verification page
- [ ] 7.3.4 Forgot password page
- [ ] 7.3.5 Reset password page
- [ ] 7.3.6 Auth route guards (public/private)

### 7.4 Home Page
- [ ] 7.4.1 Greeting + wallet balance card
- [ ] 7.4.2 Search bar (debounced)
- [ ] 7.4.3 Categories horizontal scroll
- [ ] 7.4.4 Popular services
- [ ] 7.4.5 Active request card (with progress)
- [ ] 7.4.6 Recent requests list
- [ ] 7.4.7 Notification indicator

### 7.5 Service Pages
- [ ] 7.5.1 Categories grid page
- [ ] 7.5.2 Services list page (filter + search + pagination)
- [ ] 7.5.3 Service detail page
- [ ] 7.5.4 `ServiceCard` component
- [ ] 7.5.5 `CategoryCard` component

### 7.6 Request Flow (Multi-Step)
- [ ] 7.6.1 Step 1: Service confirmation
- [ ] 7.6.2 Step 2: Dynamic form fill
- [ ] 7.6.3 Step 3: File upload
- [ ] 7.6.4 Step 4: Contact method selection
- [ ] 7.6.5 Step 5: Review
- [ ] 7.6.6 Step 6: Submit (with optimistic UI)
- [ ] 7.6.7 Stepper / progress indicator
- [ ] 7.6.8 `FileUploader` component (drag-drop + camera capture)
- [ ] 7.6.9 `DynamicForm` renderer

### 7.7 Request Tracking & List
- [ ] 7.7.1 My requests list page
- [ ] 7.7.2 Request detail page with timeline
- [ ] 7.7.3 `RequestTimeline` component
- [ ] 7.7.4 `RequestCard` component
- [ ] 7.7.5 Chat entry point
- [ ] 7.7.6 Invoice entry point
- [ ] 7.7.7 Pay button (when WaitingForPayment)

### 7.8 Wallet Pages
- [ ] 7.8.1 Wallet home (balance + actions)
- [ ] 7.8.2 Deposit flow (amount → gateway → verify → success)
- [ ] 7.8.3 Transactions list (paginated, filterable)
- [ ] 7.8.4 `TransactionItem` component
- [ ] 7.8.5 Invoice viewer
- [ ] 7.8.6 `InvoiceCard` component

### 7.9 Profile Pages
- [ ] 7.9.1 Profile view & edit
- [ ] 7.9.2 Change password
- [ ] 7.9.3 Manage contact info
- [ ] 7.9.4 Sessions list & revoke
- [ ] 7.9.5 Notification preferences

### 7.10 Notifications Page
- [ ] 7.10.1 Notification list
- [ ] 7.10.2 Mark as read (single + bulk)
- [ ] 7.10.3 `NotificationItem` component
- [ ] 7.10.4 Filter by type

**Phase 7 Exit Criteria:** Customer can complete full flow: login → browse → submit request → track → chat → pay → receive invoice — all on mobile, native-feel.

---

## 🛠️ Phase 8 — Operator Dashboard

**Goal:** Operator workspace for handling requests.

### 8.1 Operator Layout
- [ ] 8.1.1 Operator shell (different from customer)
- [ ] 8.1.2 Top bar with operator info + assigned count
- [ ] 8.1.3 Sidebar (desktop) / bottom nav (mobile) tabs: Dashboard, Queue, Assigned, Chat, Profile

### 8.2 Operator Dashboard
- [ ] 8.2.1 KPI cards (New, Reviewing, WaitingForCustomer, InProgress, WaitingForPayment, Paid today, Completed today)
- [ ] 8.2.2 Quick action: Take next from queue
- [ ] 8.2.3 Recent activity feed
- [ ] 8.2.4 Unread chats indicator

### 8.3 Request Queue
- [ ] 8.3.1 Tabs by status
- [ ] 8.3.2 Search + filter (tracking code, customer, service)
- [ ] 8.3.3 `RequestCard` (operator variant with assign + last message)
- [ ] 8.3.4 Sort: newest, oldest, waiting longest

### 8.4 Request Detail (Operator)
- [ ] 8.4.1 Customer info panel
- [ ] 8.4.2 Submitted form data viewer
- [ ] 8.4.3 Attachments viewer (with download)
- [ ] 8.4.4 Status changer (with note)
- [ ] 8.4.5 Cost editor (material + additional)
- [ ] 8.4.6 Discount applier (permission-gated)
- [ ] 8.4.7 Assign / reassign
- [ ] 8.4.8 Chat panel
- [ ] 8.4.9 Send payment link to customer
- [ ] 8.4.10 Mark complete (with confirmation)
- [ ] 8.4.11 History / audit log viewer

### 8.5 Operator Activity Log
- [ ] 8.5.1 Personal activity history
- [ ] 8.5.2 Stats: requests handled, avg completion time

**Phase 8 Exit Criteria:** Operator can self-serve full request lifecycle without admin intervention.

---

## 👑 Phase 9 — Admin Dashboard

**Goal:** Complete administrative control over the entire system.

### 9.1 Admin Layout
- [ ] 9.1.1 Admin shell (sidebar + topbar)
- [ ] 9.1.2 Admin navigation: Dashboard, Users, Operators, Roles & Permissions, Categories, Services, Service Forms, Requests, Wallets, Payments, Invoices, Discounts, Contact Methods, Notifications, Push, Chat, Reports, Audit Logs, Settings

### 9.2 Admin Dashboard
- [ ] 9.2.1 KPI grid (New, Active, Completed, Cancelled, Revenue today, Wallet transactions, Payments, Customers, Operators, Services, Categories, Unread chats, Notifications)
- [ ] 9.2.2 Charts: revenue trend (daily/monthly/yearly), requests by status, top services, payment success rate
- [ ] 9.2.3 Recent activity feed

### 9.3 Users Management
- [ ] 9.3.1 Users list (search, filter by role/status, paginated)
- [ ] 9.3.2 User detail view
- [ ] 9.3.3 Edit user (name, phone, email, status)
- [ ] 9.3.4 Assign / revoke roles
- [ ] 9.3.5 Reset user password
- [ ] 9.3.6 Ban / unban user
- [ ] 9.3.7 View user sessions, wallet, requests

### 9.4 Operators Management
- [ ] 9.4.1 Operators list
- [ ] 9.4.2 Create operator account
- [ ] 9.4.3 Assign permissions (granular)
- [ ] 9.4.4 Activate / deactivate
- [ ] 9.4.4 View operator stats (assigned, completed, avg time)

### 9.5 Roles & Permissions
- [ ] 9.5.1 Roles list
- [ ] 9.5.2 Create role
- [ ] 9.5.3 Edit role permissions (matrix UI)
- [ ] 9.5.4 Delete role (with safe-guard)

### 9.6 Catalog Management
- [ ] 9.6.1 Categories manager (CRUD + reorder)
- [ ] 9.6.2 Services manager (CRUD)
- [ ] 9.6.3 Service form builder (drag-drop, all field types)
- [ ] 9.6.4 Pricing editor
- [ ] 9.6.5 Material cost defaults

### 9.7 Requests Management
- [ ] 9.7.1 All requests list (advanced filter)
- [ ] 9.7.2 Force-assign
- [ ] 9.7.3 Force status change (with audit)
- [ ] 9.7.4 Refund initiator
- [ ] 9.7.5 Cancel / reject request

### 9.8 Financial Management
- [ ] 9.8.1 Wallets overview (all users)
- [ ] 9.8.2 Manual adjustment (with reason + audit)
- [ ] 9.8.3 Refund management
- [ ] 9.8.4 Payments list (filter by status/gateway)
- [ ] 9.8.5 Invoices list
- [ ] 9.8.6 Discount codes CRUD
- [ ] 9.8.7 Discount usage stats

### 9.9 Communication Channels
- [ ] 9.9.1 Contact methods manager (CRUD + reorder + active)
- [ ] 9.9.2 Push subscription list
- [ ] 9.9.3 Send broadcast notification
- [ ] 9.9.4 Chat moderation (view any chat room)

### 9.10 Reports
- [ ] 9.10.1 Financial reports (daily/monthly/yearly revenue, fees, discounts, refunds)
- [ ] 9.10.2 Service reports (count per service/category, revenue per service, avg duration)
- [ ] 9.10.3 Wallet transaction reports
- [ ] 9.10.4 Payment success/failure reports
- [ ] 9.10.5 Date range filter + export (CSV/Excel)

### 9.11 Audit Log
- [ ] 9.11.1 Audit log viewer (filter by user, action, entity, date)
- [ ] 9.11.2 Diff viewer (old vs new data)
- [ ] 9.11.3 Export

### 9.12 Settings
- [ ] 9.12.1 General (name, logo, currency, timezone, contact info)
- [ ] 9.12.2 Notification settings
- [ ] 9.12.3 Payment gateway settings (with secret masking)
- [ ] 9.12.4 Pusher/Soketi settings
- [ ] 9.12.5 PWA settings (app icons, theme color)
- [ ] 9.12.6 File upload limits
- [ ] 9.12.7 Request settings (auto-assign strategy, etc.)
- [ ] 9.12.8 SMS provider settings

**Phase 9 Exit Criteria:** Admin can manage every entity in the system. All sensitive actions audit-logged.

---

## 💬 Phase 10 — Real-Time Chat + Pusher

**Goal:** Real-time chat between customer and operator per request room.

### 10.1 Pusher.com Integration (Cloud — no WebSocket server needed)
- [ ] 10.1.1 Configure Pusher.com account (app_id, key, secret, cluster)
- [ ] 10.1.2 Setup Pusher server SDK in `apps/api` (pusher-nodejs)
- [ ] 10.1.3 Configure auth endpoint `POST /api/v1/broadcasting/auth` (signed JWT verification)
- [ ] 10.1.4 Define private channel naming: `private-request.{requestId}`
- [ ] 10.1.5 Define presence channels: `presence-request.{requestId}`
- [ ] 10.1.6 Define user-level private channels: `private-user.{userId}`
- [ ] 10.1.7 Configure Pusher webhook endpoint `POST /api/v1/broadcasting/webhook` (for channel_existence events)
- [ ] 10.1.8 Setup `apps/web` pusher-js client with auth transport pointing to backend
- [ ] 10.1.9 Document Pusher plan limits (channels, messages, connections) and capacity planning
- [ ] 10.1.10 Configure Pusher TLS verification (reject unauthorized)
- [ ] 10.1.11 **Note:** No Soketi server, no Redis adapter needed for shared hosting — Pusher handles scaling

### 10.2 Chat Data Model
- [ ] 10.2.1 Create `chat_rooms` migration (id, uuid, request_id UNIQUE, type, created_at)
- [ ] 10.2.2 Create `chat_participants` migration (room_id, user_id, joined_at, last_read_at)
- [ ] 10.2.3 Create `messages` migration (id, uuid, room_id, sender_id, type [text/image/file/system], body, metadata, created_at, deleted_at)
- [ ] 10.2.4 Create `message_attachments` migration (message_id, file_id, file_name, mime, size)
- [ ] 10.2.5 Create `message_reads` migration (message_id, user_id, read_at) — or use counter approach

### 10.3 Chat Endpoints
- [ ] 10.3.1 `GET /api/v1/requests/:id/messages` (paginated, cursor-based)
- [ ] 10.3.2 `POST /api/v1/requests/:id/messages` (text)
- [ ] 10.3.3 `POST /api/v1/requests/:id/messages/file` (image/file)
- [ ] 10.3.4 `POST /api/v1/requests/:id/messages/:id/read`
- [ ] 10.3.5 `DELETE /api/v1/requests/:id/messages/:id` (soft delete by sender)
- [ ] 10.3.6 Authorization: only customer of request + assigned operator + admin

### 10.4 Real-Time Events
- [ ] 10.4.1 Emit `MessageSent` on private-request.{id}
- [ ] 10.4.2 Emit `MessageRead` on private-request.{id}
- [ ] 10.4.3 Emit `RequestStatusChanged` on private-request.{id}
- [ ] 10.4.4 Emit `RequestPriceChanged` on private-request.{id}
- [ ] 10.4.5 Emit `NotificationCreated` on private-user.{id}
- [ ] 10.4.6 Emit `WalletUpdated` on private-user.{id}
- [ ] 10.4.7 Emit `PaymentCompleted` on private-user.{id}

### 10.5 Chat UI (Customer + Operator)
- [ ] 10.5.1 `ChatMessage` component (text/image/file/system)
- [ ] 10.5.2 `ChatInput` component (text + attach)
- [ ] 10.5.3 Message list (infinite scroll up)
- [ ] 10.5.4 Unread counter badge
- [ ] 10.5.5 Typing indicator (optional, via presence)
- [ ] 10.5.6 Read receipts (✓✓)
- [ ] 10.5.7 Optimistic send + rollback on error
- [ ] 10.5.8 Connection state indicator
- [ ] 10.5.9 Auto-reconnect on drop

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

| Phase | Title | Status | Completion | Started | Completed |
|-------|-------|--------|-----------|---------|-----------|
| 0 | Architecture & Planning | ✅ Done | 100% | 2026-09-28 | 2026-09-28 |
| 1 | Foundation (Stack/DB/API) | ✅ Done | 100% | 2026-09-28 | 2026-09-28 |
| 2 | Auth + RBAC | ⏳ Pending | 0% | — | — |
| 3 | Catalog + Dynamic Forms | ⏳ Pending | 0% | — | — |
| 4 | Requests + Workflow | ⏳ Pending | 0% | — | — |
| 5 | Pricing + Invoice | ⏳ Pending | 0% | — | — |
| 6 | Wallet + Payment | ⏳ Pending | 0% | — | — |
| 7 | Customer UI | ⏳ Pending | 0% | — | — |
| 8 | Operator Dashboard | ⏳ Pending | 0% | — | — |
| 9 | Admin Dashboard | ⏳ Pending | 0% | — | — |
| 10 | Real-Time Chat + Pusher | ⏳ Pending | 0% | — | — |
| 11 | Notification + Web Push | ⏳ Pending | 0% | — | — |
| 12 | PWA + Offline | ⏳ Pending | 0% | — | — |
| 13 | Reports + Audit + Settings | ⏳ Pending | 0% | — | — |
| 14 | Security Hardening | ⏳ Pending | 0% | — | — |
| 15 | Testing | ⏳ Pending | 0% | — | — |
| 16 | Production Deployment | ⏳ Pending | 0% | — | — |

**Overall:** 2 / 17 phases complete · ~12% of overall project

---

## 📝 Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-09-28 | Architect | Initial creation — Phase 0 complete, all 16 phases scoped |
| 2026-09-28 | Architect | **Revision 2**: Switched to Pusher cloud (removed Soketi), MySQL primary (PostgreSQL optional), iPanel SMS, ZarinPal payment, added Dual Deployment Profile for shared hosting compatibility. Removed Redis/MinIO as hard requirements — now optional via env drivers. Added cron-based worker CLI. |
| 2026-09-28 | Architect | Stakeholder approved architecture + 5 confirmation questions answered. Phase 1 marked as in_progress. |
| 2026-09-28 | Architect | **Phase 1 complete**: Monorepo (Turborepo + pnpm), NestJS 11 + Prisma (MySQL 8, 25+ entities, 47 permissions seed), Next.js 16 PWA with RTL Persian, dual deployment profile (Cache/Queue/Storage abstractions), Pusher integration, Worker CLI for cron, Docker/PM2/.htaccess configs, 6 ADRs, full docs. 119 files committed. CI workflow committed locally but cannot be pushed without `workflow` scope on token — stakeholder action item. |

---

## 🤝 Stakeholder Approval

- [x] **Architecture approved** — proceed to Phase 1 ✅ (2026-09-28)
- [x] Stakeholder confirmed: Pusher cloud + iPanel SMS + ZarinPal payment + Pattern-based OTP
- [x] Stakeholder confirmed: Dual deployment profile, Shared hosting first priority
- [x] Stakeholder confirmed: Execution workflow (in_progress → code → completed → report)
- [ ] ~~**Architecture needs revision**~~ (not needed)

> Once approved, this file will be updated at the end of every phase. Each phase will commit its own progress with a `chore(tasks): complete phase N` commit message.
