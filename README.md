# StudyShare

A production-grade, secure platform where verified students **share and discover
academic resources** (lessons, summaries, exercises) organized by academic
branch and subject — and post, upvote, and fulfill **requests** for materials
they can't find. Everything is moderated and audited.

Built as a **pnpm monorepo**: a Fastify + Prisma/PostgreSQL API, a React + Vite
frontend, and a shared package of Zod schemas & types used by both sides so the
request/response contract never drifts.

---

## Table of contents

- [Quick start](#quick-start)
- [Seeded accounts](#seeded-accounts)
- [Architecture](#architecture)
- [Local development](#local-development)
- [Testing](#testing)
- [Environment variables](#environment-variables)
- [Production](#production)
- [Security notes](#security-notes)

---

## Quick start

Requirements: **Docker + Docker Compose**. (For non-Docker local dev you also
need Node 20+ and pnpm 9 — see [Local development](#local-development).)

```bash
cp .env.example .env          # sensible dev defaults already filled in
docker compose up             # postgres, minio, mailhog, api, web
```

Then open:

| Service            | URL                                            |
| ------------------ | ---------------------------------------------- |
| Web app            | http://localhost:5173                          |
| API                | http://localhost:4000                          |
| API docs (Swagger) | http://localhost:4000/docs                     |
| Mailhog (emails)   | http://localhost:8025                          |
| MinIO console      | http://localhost:9001 (`minioadmin`/`minioadmin`) |
| Postgres           | localhost:**55432** (avoids clashing with a local 5432) |

The API container runs `prisma migrate deploy` on start. To load sample data
(branches, subjects, resources, requests, and the accounts below):

```bash
docker compose exec api pnpm db:seed
# or, running the API locally: pnpm --filter @studyshare/api db:seed
```

Health checks: `GET /health` (liveness) and `GET /ready` (checks DB + storage).

## Seeded accounts

| Role      | Email                        | Password             |
| --------- | ---------------------------- | -------------------- |
| Admin     | `admin@studyshare.local`     | `Admin!Pass123`      |
| Moderator | `moderator@studyshare.local` | `Moderator!Pass123`  |
| Student   | `student@studyshare.local`   | `Student!Pass123`    |

> Dev credentials only — never use these in production.

## Architecture

```
studyshare/
├─ apps/
│  ├─ api/      Fastify v5 + TypeScript (strict) + Prisma/PostgreSQL
│  │           buildApp() factory (reused by tests), plugins, modules, lib
│  └─ web/      React 18 + Vite + Tailwind + React Router + TanStack Query
├─ packages/
│  └─ shared/   Zod schemas + inferred types + RBAC permission matrix + error codes
├─ docker-compose.yml         dev stack (hot reload)
├─ docker-compose.prod.yml    production images (Nginx-served web)
└─ .github/workflows/ci.yml   lint + typecheck + test
```

**Key ideas**

- **Shared contract** — request/response schemas live once in `packages/shared`
  and are validated identically on the server (Fastify + `fastify-type-provider-zod`)
  and the client (React Hook Form + Zod resolver).
- **RBAC matrix** — a typed `action → roles` map in `packages/shared`. The
  backend enforces it (the truth); the frontend consults it only to hide/disable
  UI. Ownership checks prevent IDOR on top of role checks.
- **Moderation pipeline** — uploads land `PENDING`, are virus-scan-hookable, and
  become visible only after a moderator approves them.
- **Audit trail** — an append-only `AuditLog` records every security- and
  content-significant action, exposed read-only to admins (with CSV export).

### Tech stack

Backend: Fastify, Prisma, PostgreSQL, Zod, `@fastify/jwt`/`cookie`/`csrf-protection`/
`helmet`/`rate-limit`/`cors`/`multipart`/`oauth2`, MinIO (S3 via AWS SDK v3),
Nodemailer, Pino, Swagger, argon2, Vitest.

Frontend: React 18, Vite, Tailwind (class dark mode), React Router v6, TanStack
Query, React Hook Form, react-i18next (EN/FR), axios, lucide-react, Vitest + RTL.

## Local development

```bash
corepack enable                       # provides pnpm
pnpm install
docker compose up -d postgres minio mailhog   # infra only

# API (loads apps/api/.env automatically)
pnpm --filter @studyshare/api db:migrate:dev
pnpm --filter @studyshare/api db:seed
pnpm --filter @studyshare/api dev     # http://localhost:4000

# Web (proxies /api → :4000)
pnpm --filter @studyshare/web dev     # http://localhost:5173
```

## Testing

```bash
pnpm test        # shared unit + API integration (real Postgres) + web components
pnpm lint        # ESLint, zero warnings
pnpm typecheck   # tsc --noEmit across all packages
```

Backend integration tests run against the **dockerized Postgres** in a dedicated
`test` schema (start it with `docker compose up -d postgres minio`). They cover
happy paths plus auth failures, authz denials, validation errors, refresh-token
reuse detection, magic-byte upload rejection, quota limits, and IDOR attempts.
Web tests (Vitest + React Testing Library) cover the theme toggle, i18n
switching, guarded routes, and form validation.

## Environment variables

Every variable is documented in [`.env.example`](./.env.example) and validated
at boot by `apps/api/src/config/env.ts` (the API refuses to start on
missing/invalid values). Highlights:

- `DATABASE_URL`, `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (≥32 chars),
  `COOKIE_SECRET`, `CSRF_SECRET`
- `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` — leave blank to disable Google login
- `SMTP_*` (Mailhog in dev), `S3_*` (MinIO), `MAX_UPLOAD_BYTES`,
  `USER_STORAGE_QUOTA_BYTES`, `RATE_LIMIT_*`, `CORS_ORIGIN`, `SENTRY_DSN`

## Production

```bash
# Provide real secrets in .env (COOKIE_SECURE=true, strong JWT/cookie secrets,
# POSTGRES_PASSWORD, S3 keys), then:
docker compose -f docker-compose.prod.yml up --build
```

Production images are multi-stage (build → slim runtime), run as a non-root user,
ship only production dependencies, and the web app is served by **Nginx** with
security headers and an `/api` reverse proxy. The API entrypoint applies pending
migrations before starting.

## Security notes

- **Passwords** hashed with **argon2id**; a server-side zxcvbn strength gate
  rejects weak-but-compliant passwords. Hashes are never logged or returned.
- **Sessions** — short-lived access JWT (in memory on the client) + a rotating
  refresh token in an **httpOnly, Secure, SameSite=strict** cookie, stored
  hashed. Refresh tokens rotate on every use; **reuse of a revoked token revokes
  the whole token family**. Password reset and suspension revoke all sessions.
- **No user enumeration** — login, signup, and password-reset return generic
  responses; login runs a constant-time verify even for unknown emails.
- **CSRF** — double-submit cookie (`@fastify/csrf-protection`) on cookie-based
  mutations (refresh/logout); header-authenticated requests are CSRF-safe.
- **Uploads (defense in depth)** — extension allowlist + declared-MIME check +
  **magic-byte sniffing** (rejects renamed executables), SHA-256 checksums,
  random storage keys (never the original name), a **private** bucket with
  short-lived signed-URL downloads forced to `attachment`, per-user quota +
  rate limits, and a pluggable ClamAV scan hook.
- **Transport & headers** — `@fastify/helmet` (CSP/HSTS/nosniff/frameguard),
  strict CORS allowlist, global + per-route rate limiting (aggressive on auth).
- **Input** — every request validated with Zod at the boundary; Prisma
  parameterizes all queries (no raw string SQL). Markdown/user text is never
  rendered as HTML.
- **Errors & logs** — a central handler maps everything to safe machine-readable
  codes (never stack traces or DB errors); Pino redacts passwords, tokens, and
  cookies; each request carries a correlation id.
- **RBAC + IDOR** — role checks via the shared matrix plus ownership checks on
  every mutable resource.
- **Audit** — append-only log of logins, logouts, resets, role/status changes,
  resource create/approve/reject/delete, uploads/downloads, and request
  fulfillment.

---

Built with Claude Code.
