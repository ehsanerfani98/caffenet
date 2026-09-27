#!/bin/bash
# ============================================================================
# Caffenet — Shared Hosting Deployment Script
# ============================================================================
# Usage: ./scripts/deploy-shared.sh [user@host] [remote-path]
# Example: ./scripts/deploy-shared.sh user@server.example.com /home/user/caffenet
#
# This script:
# 1. Builds the monorepo locally (with DEPLOYMENT_PROFILE=shared)
# 2. Uploads artifacts to shared hosting via SSH/rsync
# 3. Installs production dependencies on remote
# 4. Runs database migrations
# 5. Reloads the app (via cPanel Node.js selector or by signaling Passenger)
# ============================================================================

set -euo pipefail

# Args
REMOTE_HOST="${1:?Usage: deploy-shared.sh user@host [remote-path]}"
REMOTE_PATH="${2:-/home/$(echo "$REMOTE_HOST" | cut -d@ -f1)/caffenet}"

echo "🚀 Deploying Caffenet to shared hosting"
echo "   Remote host: $REMOTE_HOST"
echo "   Remote path: $REMOTE_PATH"

# Step 1: Local build
echo ""
echo "📦 Step 1/5: Building locally (DEPLOYMENT_PROFILE=shared)"
DEPLOYMENT_PROFILE=shared pnpm install --frozen-lockfile
DEPLOYMENT_PROFILE=shared pnpm --filter @caffenet/shared build
DEPLOYMENT_PROFILE=shared pnpm --filter @caffenet/api build
DEPLOYMENT_PROFILE=shared pnpm --filter @caffenet/web build

# Prune dev dependencies for production
echo "📦 Step 2/5: Pruning dev dependencies"
pnpm prune --prod

# Step 3: Upload via rsync (much faster than SCP for incremental updates)
echo "📤 Step 3/5: Uploading files to remote"
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude 'storage' \
  --exclude '.git' \
  --exclude 'apps/api/src' \
  --exclude 'apps/web/src' \
  --exclude 'apps/web/.next/cache' \
  ./ "$REMOTE_HOST:$REMOTE_PATH/"

# Upload the .env separately (don't overwrite if exists)
ssh "$REMOTE_HOST" "test -f $REMOTE_PATH/apps/api/.env || echo '⚠️ apps/api/.env missing — set it manually via cPanel'"

# Step 4: Install production deps on remote
echo "📥 Step 4/5: Installing production deps on remote"
ssh "$REMOTE_HOST" "cd $REMOTE_PATH && /usr/bin/npm install --omit=dev 2>&1 | tail -5"

# Generate Prisma client on remote (must match remote Node arch)
ssh "$REMOTE_HOST" "cd $REMOTE_PATH/apps/api && /usr/bin/npx prisma generate"

# Step 5: Run migrations
echo "🗄️ Step 5/5: Running database migrations"
ssh "$REMOTE_HOST" "cd $REMOTE_PATH/apps/api && /usr/bin/npx prisma migrate deploy"

# Ensure storage directories exist
ssh "$REMOTE_HOST" "mkdir -p $REMOTE_PATH/apps/api/storage/{app/{public,private},cache,logs} && chmod -R 755 $REMOTE_PATH/apps/api/storage"

# Upload web build to public_html (or a subfolder)
echo ""
echo "🌐 Uploading web build to public_html"
rsync -avz --delete \
  ./apps/web/.next/standalone/ \
  "$REMOTE_HOST:~/public_html/"

rsync -avz \
  ./apps/web/.next/static/ \
  "$REMOTE_HOST:~/public_html/apps/web/.next/static/"

rsync -avz \
  ./apps/web/public/ \
  "$REMOTE_HOST:~/public_html/"

# Copy .htaccess
rsync -avz \
  ./docker/apache/.htaccess \
  "$REMOTE_HOST:~/public_html/.htaccess"

# Copy cron.conf
rsync -avz \
  ./scripts/cron.conf \
  "$REMOTE_HOST:$REMOTE_PATH/scripts/cron.conf"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Login to cPanel → Terminal/SSH"
echo "  2. Verify .env is set: cat $REMOTE_PATH/apps/api/.env"
echo "  3. Verify Node.js app is registered in cPanel → Node.js section"
echo "  4. Setup cron jobs (paste from scripts/cron.conf)"
echo "  5. Verify TLS via cPanel → SSL/TLS Status"
echo "  6. Test: curl https://yourdomain.com/health"
