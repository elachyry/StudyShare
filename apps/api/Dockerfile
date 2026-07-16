# syntax=docker/dockerfile:1
# Multi-stage build for the StudyShare API (pnpm monorepo).
# Uses Debian slim (glibc) for reliable argon2 prebuilds + Prisma engines.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- Install all workspace dependencies (cached on manifest changes) ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

# ---- Development target (source is bind-mounted by docker-compose) ----
FROM deps AS dev
COPY . .
RUN pnpm --filter @studyshare/api db:generate
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["pnpm", "dev"]

# ---- Build the TypeScript + generate the Prisma client ----
FROM deps AS build
COPY . .
RUN pnpm --filter @studyshare/api db:generate \
  && pnpm --filter @studyshare/shared build \
  && pnpm --filter @studyshare/api build \
  && pnpm --filter @studyshare/api --prod deploy /app/out

# ---- Slim production runtime (prod deps only, non-root) ----
FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /app/out /app
# Regenerate the Prisma client for this image's engine.
RUN pnpm exec prisma generate --schema=prisma/schema.prisma
COPY apps/api/docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
  && useradd --system --uid 1001 appuser \
  && chown -R appuser /app
USER appuser
EXPOSE 4000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/server.js"]
