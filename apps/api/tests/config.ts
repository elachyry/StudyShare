/**
 * Test environment configuration. Integration tests run against a REAL Postgres
 * (the dockerized dev instance) but in a dedicated `test` schema, so they never
 * touch dev/seed data. All required secrets are provided here so env validation
 * passes when the app boots inside tests.
 */
const BASE_DB =
  process.env.TEST_DATABASE_URL_BASE ??
  'postgresql://studyshare:studyshare@localhost:55432/studyshare';

export const TEST_DATABASE_URL = `${BASE_DB}?schema=test`;

export const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'error',
  DATABASE_URL: TEST_DATABASE_URL,
  JWT_ACCESS_SECRET: 'test-access-secret-000000000000000000000000',
  JWT_REFRESH_SECRET: 'test-refresh-secret-00000000000000000000000',
  COOKIE_SECRET: 'test-cookie-secret-0000000000000000000000000',
  CSRF_SECRET: 'test-csrf-secret-000000000000000000000000000',
  COOKIE_SECURE: 'false',
  // Point storage/mail at the dev containers; tests that touch them are guarded.
  S3_ENDPOINT: 'http://localhost:9000',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  RATE_LIMIT_AUTH_MAX: '1000', // relax so functional tests aren't throttled
  RATE_LIMIT_GLOBAL_MAX: '100000',
};
