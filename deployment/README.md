# 📦 Deployment — Caffenet

Caffenet supports **two deployment profiles**. Choose the one that matches your hosting.

## 🏠 Shared Hosting Profile (NO DOCKER)

For: cPanel, DirectAdmin, LiteSpeed shared hosting (common in Iran: Liara shared, ParsPack shared, Hostiran, AriaHost, etc.)

**This profile does NOT use Docker at all.** It runs on:
- Plain Node.js (provided by hosting)
- MySQL (provided by hosting)
- Apache/LiteSpeed `.htaccess` (provided by hosting)
- Cron jobs (provided by hosting)

### Files in this folder

| File | Purpose |
|------|---------|
| `.htaccess` | Apache/LiteSpeed rewrite rules + security headers (uploaded to `public_html/`) |

### How to deploy

Read the complete step-by-step guide: [docs/deployment-shared-hosting.md](../../docs/deployment-shared-hosting.md)

Or use the automated script:
```bash
./scripts/deploy-shared.sh user@yourdomain.com /home/youruser/caffenet
```

What gets uploaded:
- `apps/api/dist/` (compiled NestJS) → `/home/USER/caffenet/api/`
- `apps/web/.next/standalone/` (compiled Next.js) → `/home/USER/public_html/`
- `deployment/shared-hosting/.htaccess` → `/home/USER/public_html/.htaccess`
- `scripts/cron.conf` → `/home/USER/caffenet/scripts/cron.conf` (paste into cPanel cron)

What runs on the server:
- Node.js process for API (via cPanel Node.js selector or Passenger)
- Node.js process for Web (Next.js standalone)
- Cron job every minute → runs `node dist/worker.js` (processes background jobs)
- Apache/LiteSpeed serves static files + proxies `/api/*` to Node.js

**No Docker image is built. No container is started.**

---

## 🚀 VPS Profile (uses Docker)

For: Hetzner, DigitalOcean, ParsPack VPS, Liara dedicated, etc.

**This profile uses Docker** for easy deployment and isolation.

### Files in this folder

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Spins up MySQL 8, Redis (optional), MinIO (optional), Mailhog |
| `api/Dockerfile` | Multi-stage build for NestJS API |
| `web/Dockerfile` | Multi-stage build for Next.js PWA |
| `mysql/init.sql` | MySQL initialization script (creates database) |

### How to deploy (VPS)

```bash
# On VPS:
git clone https://github.com/ehsanerfani98/caffenet.git
cd caffenet

# Copy env (fill in production values)
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# Build and start all containers
docker compose -f deployment/vps/docker-compose.yml up -d --build

# OR use PM2 (without Docker, just Node.js + MySQL installed):
# pnpm install --prod
# pnpm --filter @caffenet/api exec prisma migrate deploy
# pm2 start ecosystem.config.cjs
```

---

## 🆚 Comparison

| Aspect | Shared Hosting | VPS |
|--------|----------------|-----|
| Uses Docker | ❌ No | ✅ Yes (optional) |
| Cost | $5/month | $20+/month |
| Setup time | 30 min | 1-2 hours |
| Root access | ❌ No | ✅ Yes |
| Redis | ❌ No | ✅ Optional |
| PostgreSQL | ❌ No | ✅ Optional |
| Cron | ✅ Yes (1-min resolution) | ✅ Yes (or PM2 daemon) |
| TLS | cPanel AutoSSL | Caddy/Let's Encrypt |
| Scaling | Limited | Unlimited |
| Recommended for | Small internet cafes | High traffic / multiple locations |

## 🎯 Recommendation

**Start with Shared Hosting** (cheaper, simpler). When traffic grows (or if you need Redis-based queue for sub-minute job latency), migrate to VPS — **no code changes needed**, just change env vars.
