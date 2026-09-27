# Caffenet — Shared Hosting Deployment Guide

This guide walks through deploying Caffenet to a typical Iranian shared hosting provider (cPanel, DirectAdmin, or LiteSpeed-based).

## 📋 Prerequisites

Before you start, verify your hosting plan has:

- [ ] **Node.js 20+** support (Passenger, LiteSpeed LSAPI, or cPanel Node.js selector)
- [ ] **MySQL 8** database access (with `utf8mb4` charset support)
- [ ] **SSH access** (preferred) or **FTP** access for file upload
- [ ] **Cron jobs** enabled (minimum 1-minute resolution)
- [ ] **512MB+ memory** for Node.js process (check with support if unsure)
- [ ] **TLS/SSL** certificate (free AutoSSL or Let's Encrypt via cPanel)
- [ ] **`.htaccess` support** (Apache) **OR** LiteSpeed LSAPI native Node.js support

If any of these are missing, contact your hosting provider. Most Iranian shared hosts (Liara shared, ParsPack shared, Hostiran, AriaHost) offer these features on mid-tier plans.

## 🛠 Step 1: Local Build

On your local machine (Node.js 20+, pnpm 9+):

```bash
git clone https://github.com/ehsanerfani98/caffenet.git
cd caffenet

# Install deps
pnpm install

# Generate Prisma client
pnpm --filter @caffenet/api exec prisma generate

# Build everything with shared profile
DEPLOYMENT_PROFILE=shared pnpm build

# Optional: run the auto-deploy script
./scripts/deploy-shared.sh user@yourdomain.com /home/youruser/caffenet
```

## 📤 Step 2: Upload Files

### Via the auto-deploy script (recommended)

```bash
./scripts/deploy-shared.sh user@yourdomain.com /home/youruser/caffenet
```

This script:
1. Builds locally
2. Uploads via rsync (faster than FTP)
3. Installs production deps on remote
4. Runs `prisma migrate deploy`
5. Uploads web build to `~/public_html/`
6. Copies `.htaccess`

### Manual upload via SSH/FTP

Upload these to `/home/USER/caffenet/`:
- `apps/api/dist/` (compiled JS)
- `apps/api/package.json`
- `apps/api/prisma/` (schema + migrations)
- `apps/api/.env` (manually created — DO NOT upload from local)
- `packages/shared/dist/`
- `packages/shared/package.json`
- `package.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml` (critical — locks versions)

Upload to `~/public_html/`:
- `apps/web/.next/standalone/` (everything inside)
- `apps/web/.next/static/` (must be at `apps/web/.next/static/`)
- `apps/web/public/` (manifest, icons, sw.js)
- `docker/apache/.htaccess` (rename to `.htaccess`)

## ⚙️ Step 3: Configure Environment

Create `/home/USER/caffenet/apps/api/.env`:

```bash
# Deployment
DEPLOYMENT_PROFILE=shared
NODE_ENV=production
PORT=3001

# Database (from cPanel → MySQL Databases)
DATABASE_URL=mysql://DB_USER:DB_PASS@localhost:3306/USER_caffenet

# Cache + Queue + Storage (shared profile defaults)
CACHE_DRIVER=file
QUEUE_DRIVER=database
STORAGE_DRIVER=local

# JWT secrets — generate with: openssl rand -base64 64
JWT_ACCESS_SECRET=<your-generated-secret>
JWT_REFRESH_SECRET=<your-different-generated-secret>
COOKIE_SECRET=<another-generated-secret>

# Pusher
PUSHER_APP_ID=<from pusher dashboard>
PUSHER_KEY=<...>
PUSHER_SECRET=<...>
PUSHER_CLUSTER=mt1

# ZarinPal
ZARINPAL_MERCHANT_ID=<from zarinpal dashboard>
ZARINPAL_SANDBOX=false
ZARINPAL_CALLBACK_URL=https://yourdomain.com/api/v1/payments/callback

# iPanel SMS
IPANEL_API_KEY=<from ipanel dashboard>
IPANEL_SENDER=<your-sms-sender-number>
IPANEL_OTP_PATTERN_CODE=<pattern-id-from-ipanel>
IPANEL_OTP_PARAM_NAME=code

# VAPID (generate locally with: npx web-push generate-vapid-keys)
VAPID_PUBLIC_KEY=<public-key>
VAPID_PRIVATE_KEY=<private-key>
VAPID_SUBJECT=mailto:admin@yourdomain.com

# Mail (optional — use SMTP from hosting)
MAIL_HOST=mail.yourdomain.com
MAIL_PORT=587
MAIL_USER=noreply@yourdomain.com
MAIL_PASS=<mail-password>
MAIL_FROM=noreply@yourdomain.com

# CORS
CORS_ORIGINS=https://yourdomain.com
```

For the web (Next.js PWA), create `~/public_html/.env.local`:

```
DEPLOYMENT_PROFILE=shared
NEXT_PUBLIC_API_URL=https://yourdomain.com/api/v1
NEXT_PUBLIC_PUSHER_KEY=<same-as-backend-PUSHER_KEY>
NEXT_PUBLIC_PUSHER_CLUSTER=mt1
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<same-as-backend-VAPID_PUBLIC_KEY>
```

## 🗄 Step 4: Database Setup

### 4.1 Create the database
In cPanel → MySQL Databases:
1. Create database: `USER_caffenet` (the `USER_` prefix is automatic in cPanel)
2. Create user: `USER_caffenet_user` (grant ALL privileges on the database)
3. Note the password — use it in `DATABASE_URL`

### 4.2 Ensure proper charset
Run this SQL in phpMyAdmin:
```sql
ALTER DATABASE USER_caffenet CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4.3 Run migrations
Via SSH:
```bash
cd /home/USER/caffenet/apps/api
node_modules/.bin/prisma migrate deploy
node_modules/.bin/prisma db seed
```

If SSH is unavailable, you can run migrations via a temporary PHP script:
```php
<?php
// migration-runner.php — run via web browser
exec('cd /home/USER/caffenet/apps/api && /usr/bin/node node_modules/prisma/build/index.js migrate deploy 2>&1', $output, $code);
echo implode("\n", $output);
echo "\nExit code: $code";
```

## 🚀 Step 5: Register Node.js App in cPanel

### cPanel with Node.js selector
1. Go to cPanel → **Setup Node.js App**
2. Click **Create Application**
3. Set:
   - **Node.js version**: 20.x (or latest available)
   - **Application mode**: Production
   - **Application root**: `/home/USER/caffenet/api`
   - **Application URL**: `api.yourdomain.com` or `yourdomain.com/api`
   - **Application startup file**: `dist/main.js`
4. Under **Environment variables**, paste the contents of your `.env` file (one var per line, KEY=VALUE)
5. Click **Create** or **Restart**
6. Note: cPanel will install `node_modules` for you automatically using `pnpm install --prod`

### DirectAdmin with Passenger
1. Go to **Advanced Features → Node.js**
2. Set **App root**: `/home/USER/caffenet/api`
3. Set **App URL**: `api.yourdomain.com` or `yourdomain.com/api`
4. Set **Startup file**: `dist/main.js`
5. Save → Restart

### LiteSpeed LSAPI
1. Contact hosting support to enable LSAPI Node.js app
2. Configure similarly to above
3. LiteSpeed LSAPI is the fastest option for shared hosting

## ⏰ Step 6: Setup Cron Jobs

In cPanel → **Cron Jobs**:

| Minute | Hour | Day | Month | Weekday | Command |
|--------|------|-----|-------|---------|---------|
| `*` | `*` | `*` | `*` | `*` | `cd /home/USER/caffenet/api && /usr/bin/node dist/worker.js --max-jobs=50 --timeout=55 >> storage/logs/cron-worker.log 2>&1` |
| `*/5` | `*` | `*` | `*` | `*` | `cd /home/USER/caffenet/api && /usr/bin/node dist/worker.js --queue caffenet-cleanup --once >> storage/logs/cron-cleanup.log 2>&1` |
| `0` | `3` | `*` | `*` | `*` | `/usr/bin/mysqldump --single-transaction -u USER_caffenet_user -p'DB_PASS' USER_caffenet \| gzip > /home/USER/backups/caffenet-$(date +\%Y\%m\%d).sql.gz` |
| `0` | `4` | `*` | `*` | `0` | `find /home/USER/backups/ -name 'caffenet-*.sql.gz' -mtime +30 -delete` |

Replace `USER`, `DB_PASS`, `/usr/bin/node`, `/usr/bin/mysqldump` with the correct paths on your server. You can find these with `which node`, `which mysqldump` via SSH.

## 🔒 Step 7: TLS Certificate

In cPanel → **SSL/TLS Status → Run AutoSSL**:
1. Select your domain
2. Click **Run AutoSSL**
3. Wait for completion (usually 5-10 minutes)
4. Verify by visiting `https://yourdomain.com`

Enable **Force HTTPS Redirect** in cPanel → **Domains** → your domain.

## 📂 Step 8: Directory Permissions

Via SSH:
```bash
mkdir -p /home/USER/caffenet/api/storage/{app/{public,private},cache,logs}
mkdir -p /home/USER/backups
chmod -R 755 /home/USER/caffenet/api/storage
chmod -R 750 /home/USER/caffenet/api/.env
```

The `.env` file must be readable by the Node.js process user only.

## ✅ Step 9: Verify

### Health check
```bash
curl https://yourdomain.com/api/v1/health
# Expected: {"status":"ok","profile":"shared",...}
```

### Readiness check
```bash
curl https://yourdomain.com/api/v1/health/ready
# Expected: {"status":"ready","database":"up",...}
```

### PWA manifest
```bash
curl https://yourdomain.com/manifest.webmanifest
# Expected: JSON manifest
```

### OpenAPI docs (disabled in production)
By default, OpenAPI UI is disabled in production. To temporarily enable, set `NODE_ENV=development` and restart the app — but **revert to production** before going live.

## 🐛 Troubleshooting

### Cron worker not running
- Check `storage/logs/cron-worker.log` for errors
- Verify the cron job is registered: `crontab -l`
- Check that `node` is at `/usr/bin/node` — if not, update the cron command
- Try running manually: `cd /home/USER/caffenet/api && /usr/bin/node dist/worker.js --once`

### API returns 502 Bad Gateway
- The Node.js app crashed — check cPanel Node.js selector logs
- Common cause: env var missing (verify all required vars are set)
- Memory limit exceeded — contact host to increase memory limit

### Pusher events not received
- Verify `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET` are correct
- Verify the frontend `NEXT_PUBLIC_PUSHER_KEY` matches backend `PUSHER_KEY`
- Check Pusher dashboard for delivery logs
- Verify TLS is enabled (Pusher requires HTTPS for private channels)

### Payment callback fails
- Verify `ZARINPAL_CALLBACK_URL` points to the correct domain (https, not http)
- Test the callback URL manually with a GET request — should return 400 (no params)
- Check `payment_callbacks` table for raw callback payloads

### Files can't be uploaded
- Verify `STORAGE_DRIVER=local`
- Verify `storage/app/public` and `storage/app/private` directories exist and are writable
- Check file size against `FILE_UPLOAD_MAX_SIZE`

## 📚 References

- [TASKS.md](../TASKS.md) — project tracker
- [ADR-0001: Dual Deployment Profile](../docs/adr/0001-dual-deployment-profile.md)
- [Scripts](../scripts/) — deployment scripts
