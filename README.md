# Caffenet ☕ — Internet Cafe Service Platform

> Production-Ready platform for managing Internet Cafe services — built mobile-first, RTL Persian, PWA, with real-time chat, wallet, online payment, dynamic service forms, and a complete admin/operator/customer triad.

[![CI](https://github.com/ehsanerfani98/caffenet/actions/workflows/ci.yml/badge.svg)](https://github.com/ehsanerfani98/caffenet/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 📋 Table of Contents

- [⚠️ Important: Docker & Shared Hosting](#-important-docker--shared-hosting)
- [Stack](#-stack)
- [Monorepo Structure](#-monorepo-structure)
- [Quick Start (Local Dev — optional Docker)](#-quick-start-local-dev--optional-docker)
- [Shared Hosting Deployment (NO DOCKER)](#-shared-hosting-deployment-no-docker)
- [VPS Deployment (uses Docker)](#-vps-deployment-uses-docker)
- [Environment Variables](#-environment-variables)
- [Database](#-database)
- [Real-Time (Pusher)](#-real-time-pusher)
- [Worker / Background Jobs](#-worker--background-jobs)
- [Project Status](#-project-status)

---

## ⚠️ Important: Docker & Shared Hosting

**Caffenet supports two deployment profiles. Docker is OPTIONAL — only used in the VPS profile.**

| Profile | Docker used? | Description |
|---------|---------------|-------------|
| 🏠 **Shared Hosting** | ❌ **NO Docker** | Plain Node.js + MySQL + Apache/LiteSpeed. Built for cPanel/DirectAdmin/LiteSpeed hosts common in Iran. |
| 🚀 **VPS** | ✅ Docker (optional) | Multi-container setup with MySQL, Redis, MinIO via docker-compose. PM2 for daemon workers. |

**The shared hosting profile never uses Docker anywhere** — no Dockerfiles, no `docker-compose`, no container runtime. The deployment script (`scripts/deploy-shared.sh`) just:
1. Builds the JS locally
2. Uploads via SSH/rsync
3. Installs production `node_modules` on the remote
4. Runs Prisma migrations
5. Configures cron jobs

See [deployment/README.md](./deployment/README.md) for the comparison and [docs/deployment-shared-hosting.md](./docs/deployment-shared-hosting.md) for the full shared hosting guide.

## 🛠 Stack

| Layer | Technology | Shared hosting? | VPS? |
|-------|------------|------------------|------|
| Frontend | Next.js 16 (App Router) + PWA | ✅ | ✅ |
| Backend | NestJS 11 | ✅ | ✅ |
| Database | MySQL 8 (InnoDB) | ✅ (provided by host) | ✅ (Docker or self-hosted) |
| ORM | Prisma 5 | ✅ | ✅ |
| Real-Time | Pusher.com (cloud) | ✅ (external) | ✅ (external) |
| SMS | iPanel (pattern-based OTP) | ✅ | ✅ |
| Payment | ZarinPal | ✅ | ✅ |
| Cache | File-based (default) / Redis (optional) | ✅ file | ✅ Redis |
| Queue | Database table + Cron (default) / BullMQ (optional) | ✅ DB+cron | ✅ BullMQ |
| Storage | Local filesystem (default) / S3-compatible (optional) | ✅ local | ✅ S3/MinIO |
| Auth | JWT RS256 + Refresh + OTP | ✅ | ✅ |
| Process Mgmt | Cron + stateless HTTP / PM2 (VPS) | ✅ cron | ✅ PM2 |
| Docker | — | ❌ Not used | ✅ Optional |

## 📁 Monorepo Structure

```
caffenet/
├── apps/
│   ├── web/                      # Next.js 16 PWA (Customer + Operator + Admin)
│   └── api/                      # NestJS 11 (stateless API + worker CLI)
├── packages/
│   ├── shared/                   # DTOs, enums, constants, types
│   ├── ui/                       # Reusable React components (Phase 7)
│   └── config/                   # ESLint, Prettier, TS configs
├── deployment/                   # ← Deployment configs are here (not in docker/)
│   ├── shared-hosting/           # .htaccess + scripts for shared hosting (NO DOCKER)
│   └── vps/                      # docker-compose.yml + Dockerfiles (VPS only)
├── scripts/                      # deploy-shared.sh + cron.conf
├── docs/                         # ADRs, runbooks, deployment guides
└── TASKS.md                      # Master task tracker (16 phases)
```

> **Note:** The old `docker/` folder has been reorganized into `deployment/shared-hosting/` and `deployment/vps/` to make it crystal clear which files are needed for each profile.

## 🚀 Quick Start (Local Dev — optional Docker)

**Prerequisites:** Node.js 20+, pnpm 9+ (Docker is optional — only if you want MySQL via container)

### Option A: With Docker (for VPS-style dev)

```bash
# Clone
git clone https://github.com/ehsanerfani98/caffenet.git
cd caffenet

# Install dependencies
pnpm install

# Copy env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# Start MySQL via Docker (optional — you can also install MySQL locally)
docker compose -f deployment/vps/docker-compose.yml up -d mysql

# Generate Prisma client + run migrations + seed
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# Start dev servers (API + Web in parallel)
pnpm dev
```

### Option B: Without Docker (use your own MySQL)

```bash
# Install MySQL 8 locally (apt install mysql-server OR brew install mysql)
# Create database: CREATE DATABASE caffenet CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Set DATABASE_URL in apps/api/.env to point to your local MySQL
DATABASE_URL=mysql://root:yourpassword@localhost:3306/caffenet

# Then same as above:
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- API: http://localhost:3001
- Web: http://localhost:3000
- OpenAPI docs: http://localhost:3001/api/docs
- Prisma Studio: `pnpm db:studio`

## 🌐 Shared Hosting Deployment (NO DOCKER)

**This path does not use Docker in any way.** Detailed guide: [docs/deployment-shared-hosting.md](./docs/deployment-shared-hosting.md)

Quick summary:

1. **Build locally:**
   ```bash
   DEPLOYMENT_PROFILE=shared pnpm build
   ```

2. **Upload via SSH/FTP** (no Docker):
   - `apps/api/dist/` + `apps/api/package.json` + `apps/api/prisma/` → `/home/USER/caffenet/api/`
   - `apps/web/.next/standalone/` + `apps/web/public/` → `/home/USER/public_html/`
   - `node_modules/` (production only) → `/home/USER/caffenet/api/node_modules/`
   - `deployment/shared-hosting/.htaccess` → `/home/USER/public_html/.htaccess`

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

5. **Register Node.js app in cPanel/DirectAdmin** → set startup file to `dist/main.js`

6. **TLS:** Use cPanel AutoSSL or Let's Encrypt.

## 🚢 VPS Deployment (uses Docker)

For VPS, you can use Docker (recommended) OR PM2 (just Node.js, no Docker).

### Option A: Docker Compose (recommended for VPS)

```bash
# Clone & install
git clone https://github.com/ehsanerfani98/caffenet.git
cd caffenet
pnpm install

# Build and start everything
docker compose -f deployment/vps/docker-compose.yml up -d --build

# Run migrations
docker compose exec api pnpm db:migrate
docker compose exec api pnpm db:seed
```

### Option B: PM2 (no Docker, even on VPS)

```bash
# Install MySQL 8 + Redis (optional) on the VPS directly
# Then:
git clone https://github.com/ehsanerfani98/caffenet.git
cd caffenet
pnpm install --prod
pnpm --filter @caffenet/api exec prisma migrate deploy
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## 🔐 Environment Variables

See:
- `apps/api/.env.example` — backend configuration
- `apps/web/.env.example` — frontend (public) configuration

**Critical env vars:**

| Variable | Description | Shared hosting | VPS |
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

- **Engine:** MySQL 8 (InnoDB) — works on both shared hosting and VPS
- **Charset:** `utf8mb4` (full Unicode including emoji)
- **Collation:** `utf8mb4_unicode_ci`
- **All amounts:** stored as `BIGINT` (minor units, e.g. Toman × 100 = Rial) — never FLOAT
- **Idempotency:** every financial record has a UNIQUE `idempotency_key` constraint
- **Locks:** `SELECT FOR UPDATE` on wallet row before any debit/credit
- **Job queue:** uses `SELECT ... FOR UPDATE SKIP LOCKED` for atomic reservation

Migrations: `apps/api/prisma/migrations/`

## 📡 Real-Time (Pusher)

We use Pusher.com cloud — **no WebSocket server to deploy**, which is what makes shared hosting compatible.

- Private channels: `private-request.{id}`, `private-user.{id}`
- Presence channels: `presence-request.{id}` (online status)
- Auth endpoint: `POST /api/v1/broadcasting/auth`
- Server SDK: `pusher` (Node.js)
- Client SDK: `pusher-js` (browser)

Pusher plan: Sandbox (free, 100 connections, 200K messages/day) — sufficient for initial launch.

## ⚙️ Worker / Background Jobs

**Shared hosting (NO Docker, NO PM2):** Cron every minute runs:
```bash
node dist/worker.js --max-jobs=50 --timeout=55
```
This processes queued jobs (notifications, push, email, SMS) up to 50 per minute, then exits.

**VPS (with PM2, optionally with Docker):** PM2 keeps the worker running continuously:
```bash
pm2 start ecosystem.config.cjs --only caffenet-api-worker
```

Job types: notification dispatch, web push, email, SMS, payment reconciliation, push subscription cleanup.

## 📊 Project Status

See [TASKS.md](./TASKS.md) for the full 16-phase tracker.

| Phase | Title | Status |
|-------|-------|--------|
| 0 | Architecture & Planning | ✅ Done |
| 1 | Foundation | ✅ Done |
| 2-16 | (Auth, Catalog, Requests, Wallet, Payment, UI, Chat, Notifications, PWA, Reports, Security, Testing, Deployment) | ⏳ Pending |

## 📝 License

MIT — see [LICENSE](LICENSE)

---

Built with ❤️ for the Iranian Internet Cafe industry.
