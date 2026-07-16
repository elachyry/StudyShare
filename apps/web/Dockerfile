# syntax=docker/dockerfile:1
# Multi-stage build for the StudyShare web app (pnpm monorepo).

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

# ---- Development target (Vite dev server; source bind-mounted) ----
FROM deps AS dev
COPY . .
WORKDIR /app/apps/web
EXPOSE 5173
CMD ["pnpm", "dev"]

# ---- Build static assets ----
FROM deps AS build
COPY . .
RUN pnpm --filter @studyshare/web build

# ---- Production: static files served by Nginx ----
FROM nginx:1.27-alpine AS prod
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
