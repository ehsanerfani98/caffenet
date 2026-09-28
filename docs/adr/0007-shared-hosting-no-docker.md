# ADR-0007: Shared Hosting Profile Does NOT Use Docker

- **Status**: Accepted
- **Date**: 2026-09-28

## Context

Stakeholder feedback after Phase 1 delivery:

> "قرار شد پروژه طوری باشه که بتوان در هاست اشتراکی استفاده کرد، در هاست اشتراکی چیزی با عنوان داکر نداریم!"
>
> (The project must work on shared hosting. Shared hosting does NOT have Docker.)

The original Phase 1 deliverable placed all Docker-related files (including the shared-hosting `.htaccess`) under a `docker/` folder. This created ambiguity about whether Docker was a requirement for shared hosting deployment.

Shared hosting providers (cPanel, DirectAdmin, LiteSpeed-based hosts common in Iran) do not support Docker:
- No Docker daemon
- No root/sudo access to install one
- No elevated kernel capabilities
- Limited memory (~256-512MB)

## Decision

**Make the "no Docker on shared hosting" rule explicit and structural:**

### 1. Folder reorganization

Old structure (ambiguous):
```
docker/
├── apache/.htaccess       ← used for shared hosting but in "docker/" folder (confusing!)
├── api/Dockerfile          ← VPS only
├── web/Dockerfile         ← VPS only
├── docker-compose.yml     ← VPS only
└── mysql/init.sql         ← VPS only
```

New structure (clear separation):
```
deployment/
├── shared-hosting/
│   ├── .htaccess           ← shared hosting only (no Docker)
│   └── README.md           ← explains shared hosting path
└── vps/
    ├── api/Dockerfile      ← VPS only
    ├── web/Dockerfile      ← VPS only
    ├── docker-compose.yml  ← VPS only
    └── mysql/init.sql      ← VPS only
```

### 2. Documentation update

- README.md has a prominent "⚠️ Important: Docker & Shared Hosting" section at the top
- README.md Stack table now shows which technologies work on shared hosting vs VPS
- docs/deployment-shared-hosting.md has a "❌ NOT required" section explicitly listing Docker, Redis, PostgreSQL, MinIO, WebSocket server, root access, and PM2 as NOT NEEDED
- deployment/README.md has a comparison table

### 3. Script clarification

`scripts/deploy-shared.sh` now has a header that explicitly states:
- What it does (build, upload, install, migrate, reload)
- What it does NOT do (no Docker, no Redis, no MinIO, no Soketi, no root)

### 4. Build commands

Two distinct build commands are documented:
- `pnpm build:shared-hosting` — for shared hosting (no Docker involvement)
- `pnpm build:vps` — for VPS (may use Docker for containerization, but still optional)

## Consequences

### Positive
- ✅ Crystal clear that shared hosting path never uses Docker
- ✅ Stakeholder confidence that the system works on their hosting
- ✅ Clear separation of concerns between profiles
- ✅ Easier to reason about which files affect which profile
- ✅ The `.htaccess` file is no longer hidden in a "docker" folder

### Negative
- ⚠️ Slightly more complex folder structure (more folders)
- ⚠️ Need to update any documentation or scripts that referenced old `docker/apache/.htaccess` path

### Mitigations
- Updated `scripts/deploy-shared.sh` to reference new path
- Updated `docs/deployment-shared-hosting.md` to reference new path
- Updated `README.md` with clear comparison table

## Verification

The shared hosting path uses NONE of these:
- ❌ `Dockerfile`
- ❌ `docker-compose.yml`
- ❌ `docker` CLI
- ❌ Container runtime
- ❌ Any `docker` import or command in code

It uses ONLY:
- ✅ Plain `node` CLI to run `dist/main.js`
- ✅ Plain `node` CLI to run `dist/worker.js` (via cron)
- ✅ Plain `npx prisma migrate deploy`
- ✅ Plain `pnpm install --prod` or `npm install --omit=dev`
- ✅ `rsync`/`scp`/`ftp` for file transfer
- ✅ `mysqldump` for backups
- ✅ Apache/LiteSpeed `.htaccess` for routing and security

## References

- [deployment/README.md](../../deployment/README.md) — deployment profile comparison
- [docs/deployment-shared-hosting.md](../deployment-shared-hosting.md) — full shared hosting guide
- ADR-0001: Dual Deployment Profile (the parent decision)
- Stakeholder feedback on 2026-09-28
