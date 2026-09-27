# Caffenet ☕ — Internet Cafe Service Platform

> Production-Ready platform for managing Internet Cafe services — built mobile-first, RTL, PWA, with real-time chat, wallet, online payment, dynamic service forms, and a complete admin/operator/customer triad.

[![CI](https://github.com/ehsanerfani98/caffenet/actions/workflows/ci.yml/badge.svg)](https://github.com/ehsanerfani98/caffenet/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 📋 Table of Contents

- [Stack](#-stack)
- [Monorepo Structure](#-monorepo-structure)
- [Quick Start (VPS dev)](#-quick-start-vps-dev)
- [Shared Hosting Deployment](#-shared-hosting-deployment)
- [Environment Variables](#-environment-variables)
- [Database](#-database)
- [Real-Time (Pusher)](#-real-time-pusher)
- [Worker / Background Jobs](#-worker--background-jobs)
- [Project Status](#-project-status)

## 🛠 Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | Next.js 16 (App Router) + PWA | Mobile-first, RTL Persian |
| Backend | NestJS 11 | Stateless, shared-hosting compatible |
| Database | MySQL 8 (primary) | PostgreSQL optional for VPS |
| ORM | Prisma 5 | Type-safe schema-first |
| Real-Time | Pusher.com (cloud) | No WebSocket server needed |
| SMS | iPanel | Pattern-based OTP |
| Payment | ZarinPal | Iranian Toman gateway |
| Cache | File-based (default) / Redis (VPS) | Switchable via env |
| Queue | Database-backed (default) / BullMQ (VPS) | Switchable via env |
| Storage | Local filesystem (default) / S3-compatible (VPS) | Switchable via env |
| Auth | JWT RS256 + Refresh + OTP | Rotating refresh tokens |

## 📁 Monorepo Structure

```
caffenet/
├── apps/
│   ├── web/                      # Next.js 16 PWA (Customer + Operator + Admin)
│   └── api/                      # NestJS 11 (stateless API + worker CLI)
├── packages/
│   ├── shared/                   # DTOs, enums, constants, types
│   ├── ui/                       # Reusable React components
│   └── config/                  # ESLint, Prettier, TS configs
├── docker/                       # Docker Compose + Dockerfiles
├── scripts/                      # Deployment & utility scripts
├── docs/                         # ADRs, runbooks
└── TASKS.md                      # Master task tracker (16 phases)
```

## 🚀 Quick Start (VPS dev)

**Prerequisites:** Node.js 20+, pnpm 9+, Docker

```bash
# Clone
git clone https://github.com/ehsanerfani98/caffenet.git
cd caffenet

# Install dependencies
pnpm install

# Copy env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# Start infra (MySQL, Redis optional, Mailhog)
docker compose -f docker/docker-compose.yml up -d

# Generate Prisma client + run migrations
pnpm db:generate
pnpm db:migrate

# Seed initial data (admin user, default categories)
pnpm db:seed

# Start dev servers (API + Web in parallel)
pnpm dev
```

- API: http://localhost:3001
- Web: http://localhost:3000
- OpenAPI: http://localhost:3001/api/docs
- Prisma Studio: `pnpm db:studio`

## 🌐 Shared Hosting Deployment

Detailed guide: [docs/deployment-shared-hosting.md](docs/deployment-shared-hosting.md)

Quick summary:

1. **Build locally:**
   ```bash
   DEPLOYMENT_PROFILE=shared pnpm build
   ```

2. **Upload via SSH/FTP:**
   - `apps/api/dist/` + `apps/api/package.json` + `apps/api/prisma/` → `/home/USER/caffenet/api/`
   - `apps/web/.next/standalone/` + `apps/web/public/` → `/home/USER/public_html/`
   - `node_modules/` (production only) → `/home/USER/caffenet/api/node_modules/`

3. **Configure `.env`:**
   ```
   DEPLOYMENT_PROFILE=shared
   DATABASE_URL=mysql://USER:PASS@localhost:3306/USER_caffenet
   CACHE_DRIVER=file
   QUEUE_DRIVER=database
   STORAGE_DRIVER=local
   ```

4. **Setup cron (every minute):**
   ```
   * * * * * cd /home/USER/caffenet/api && /usr/bin/node dist/worker.js --max-jobs=50 --timeout=55 >> storage/logs/cron.log 2>&1
   ```

5. **Configure `.htaccess`** (see `docker/apache/.htaccess`):
   - Rewrite rules for SPA routing
   - Proxy `/api/*` to Node.js (via Passenger/LSAPI)

6. **TLS:** Use cPanel AutoSSL or Let's Encrypt via cPanel.

## 🔐 Environment Variables

See:
- `apps/api/.env.example` — backend configuration
- `apps/web/.env.example` — frontend (public) configuration

**Critical env vars:**

| Variable | Description | Shared hosting default | VPS default |
|----------|-------------|-------------------------|-------------|
| `DEPLOYMENT_PROFILE` | `shared` or `vps` | `shared` | `vps` |
| `DATABASE_URL` | MySQL connection string | `mysql://...` | `mysql://...` |
| `CACHE_DRIVER` | `file` or `redis` | `file` | `redis` |
| `QUEUE_DRIVER` | `database` or `redis` | `database` | `redis` |
| `STORAGE_DRIVER` | `local` or `s3` | `local` | `s3` |
| `PUSHER_APP_ID` | Pusher app ID | (from Pusher dashboard) | (same) |
| `ZARINPAL_MERCHANT_ID` | ZarinPal merchant UUID | (from ZarinPal) | (same) |
| `IPANEL_API_KEY` | iPanel SMS API key | (from iPanel) | (same) |
| `VAPID_PUBLIC_KEY` | Web Push public key | (generated once) | (same) |
| `VAPID_PRIVATE_KEY` | Web Push private key | (generated once) | (same) |

**Never commit `.env` to git.** All secrets go in your hosting control panel or CI/CD secrets.

## 🗄 Database

- **Engine:** MySQL 8 (InnoDB)
- **Charset:** `utf8mb4` (full Unicode including emoji)
- **Collation:** `utf8mb4_unicode_ci`
- **All amounts:** stored as `BIGINT` (minor units, e.g. Toman × 100) — never FLOAT
- **Idempotency:** every financial record has a UNIQUE `idempotency_key` constraint
- **Locks:** `SELECT FOR UPDATE` on wallet row before any debit/credit

Migrations: `apps/api/prisma/migrations/`

## 📡 Real-Time (Pusher)

We use Pusher.com cloud — no WebSocket server to deploy.

- Private channels: `private-request.{id}`, `private-user.{id}`
- Presence channels: `presence-request.{id}` (online status)
- Auth endpoint: `POST /api/v1/broadcasting/auth`
- Server SDK: `pusher` (Node.js)
- Client SDK: `pusher-js` (browser)

Pusher plan: Sandbox (free, 100 connections, 200K messages/day) — sufficient for initial launch.

## ⚙️ Worker / Background Jobs

**Shared hosting:** Cron every minute runs:
```bash
node dist/worker.js --max-jobs=50 --timeout=55
```
This processes queued jobs (notifications, push, email, SMS) up to 50 per minute, then exits.

**VPS:** PM2 keeps the worker running continuously:
```bash
pm2 start ecosystem.config.cjs --only caffenet-api-worker
```

Job types: notification dispatch, web push, email, SMS, payment reconciliation, push subscription cleanup.

## 📊 Project Status

See [TASKS.md](./TASKS.md) for the full 16-phase tracker.

| Phase | Title | Status |
|-------|-------|--------|
| 0 | Architecture & Planning | ✅ Done |
| 1 | Foundation | 🚧 In Progress |
| 2-16 | (Auth, Catalog, Requests, Wallet, Payment, UI, Chat, Notifications, PWA, Reports, Security, Testing, Deployment) | ⏳ Pending |

## 📝 License

MIT — see [LICENSE](LICENSE)

---

Built with ❤️ for the Iranian Internet Cafe industry.
