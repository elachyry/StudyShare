import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './config.js';

/**
 * Runs once before the whole suite: applies migrations to the dedicated `test`
 * schema. Requires the dev Postgres to be running (`docker compose up postgres`).
 */
export default function setup(): void {
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
