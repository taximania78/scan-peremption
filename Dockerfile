# Shared base for stages that compile native modules (better-sqlite3)
FROM node:24-alpine AS build-base
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./

# ---- Builder: full install (incl. dev deps), prisma generate, next build ----
FROM build-base AS builder
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- prod-deps: production-only node_modules for the runner ----
# Provides the prisma CLI (for `migrate deploy`), @prisma/client, the
# better-sqlite3 driver adapter, and better-sqlite3 compiled for Alpine (musl).
# Versions are locked by package-lock.json — no hardcoded versions.
# Do NOT add --ignore-scripts: prisma/@prisma/engines download the schema
# engine and better-sqlite3 compiles its native binding in this step.
FROM build-base AS prod-deps
RUN npm ci --omit=dev

# ---- Runner ----
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user (must exist before COPY --chown by name)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# openssl: required by Prisma's native schema engine (migrate deploy)
# su-exec: used by start.sh to drop privileges to nextjs
RUN apk add --no-cache openssl su-exec

# Production node_modules (prisma CLI + native modules). Copied first:
# this layer only changes when the lockfile changes, so code-only rebuilds
# keep it cached.
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Prisma schema, migrations and config (needed by `prisma migrate deploy`)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./

# Static assets
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Startup script
COPY --chown=nextjs:nodejs start.sh ./
RUN chmod +x start.sh

# App: standalone server + client chunks. The standalone tree ships its own
# minimal node_modules; overlaying it onto the full prod tree above is safe
# because both were installed from the same package-lock.json on the same
# base image (identical package versions).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Database directory (docker-compose mounts a volume here)
RUN mkdir -p /app/prisma/data && chown -R nextjs:nodejs /app/prisma/data

# USER nextjs  -- intentionally not set: start.sh runs as root to fix volume
# permissions, then drops to nextjs via su-exec

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["./start.sh"]
