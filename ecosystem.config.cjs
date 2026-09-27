# ============================================================================
# Caffenet — PM2 Ecosystem Configuration (VPS deployment only)
# ============================================================================
# Usage on VPS:
#   pm2 start ecosystem.config.cjs --only caffenet-api,caffenet-api-worker
#   pm2 start ecosystem.config.cjs --only caffenet-web
#   pm2 save
#   pm2 startup
# ============================================================================

module.exports = {
  apps: [
    // NestJS API server (long-running HTTP server)
    {
      name: 'caffenet-api',
      cwd: './apps/api',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        DEPLOYMENT_PROFILE: 'vps',
        PORT: 3001,
      },
      env_staging: {
        NODE_ENV: 'staging',
        DEPLOYMENT_PROFILE: 'vps',
      },
      // Logs
      out_file: './storage/logs/pm2-api-out.log',
      error_file: './storage/logs/pm2-api-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Restart policy
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 5000,
    },

    // Worker — processes background jobs (notifications, push, email, SMS)
    {
      name: 'caffenet-api-worker',
      cwd: './apps/api',
      script: 'dist/worker.js',
      args: '--max-jobs=0 --timeout=0', // 0 = run forever (PM2 keeps it alive)
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        DEPLOYMENT_PROFILE: 'vps',
        QUEUE_DRIVER: 'redis',
      },
      env_staging: {
        NODE_ENV: 'staging',
        DEPLOYMENT_PROFILE: 'vps',
      },
      out_file: './storage/logs/pm2-worker-out.log',
      error_file: './storage/logs/pm2-worker-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },

    // Next.js PWA (long-running HTTP server)
    {
      name: 'caffenet-web',
      cwd: './apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        DEPLOYMENT_PROFILE: 'vps',
      },
      out_file: './storage/logs/pm2-web-out.log',
      error_file: './storage/logs/pm2-web-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
