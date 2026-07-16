import { defineConfig } from 'vitest/config';
import { TEST_ENV } from './tests/config.js';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: TEST_ENV,
    globalSetup: './tests/global-setup.ts',
    // Integration tests share one Postgres schema; run serially to avoid races.
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/**/*.d.ts'],
    },
  },
});
