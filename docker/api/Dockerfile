# ============================================================================
# Caffenet API — Dockerfile (multi-stage build for VPS deployment)
# ============================================================================
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN npm install -g pnpm@9
WORKDIR /app

# ---- Builder stage ----
FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
# Generate Prisma client
RUN pnpm --filter @caffenet/api exec prisma generate
# Build everything
RUN pnpm build

# ---- Production stage ----
FROM node:20-alpine AS production
RUN apk add --no-cache libc6-compat openssl
RUN npm install -g pnpm@9

WORKDIR /app

# Copy only what we need
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/turbo.json ./turbo.json

# Install production deps only
RUN pnpm install --frozen-lockfile --prod

# Generate Prisma client in prod deps
RUN pnpm --filter @caffenet/api exec prisma generate

ENV NODE_ENV=production
ENV DEPLOYMENT_PROFILE=vps
ENV PORT=3001

EXPOSE 3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O- http://localhost:3001/health || exit 1

# Start API
CMD ["node", "apps/api/dist/main.js"]
