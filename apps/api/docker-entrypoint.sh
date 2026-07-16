#!/bin/sh
set -e

# Apply any pending database migrations before starting the server. This is
# idempotent and safe to run on every boot.
echo "Running database migrations…"
pnpm exec prisma migrate deploy --schema=prisma/schema.prisma

echo "Starting StudyShare API…"
exec "$@"
