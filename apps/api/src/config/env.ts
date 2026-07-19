import { z } from 'zod';

/**
 * Environment schema. Validated once at boot; the process exits with a clear
 * message if anything is missing or malformed. Never read `process.env`
 * directly elsewhere — import `env` from here so types and defaults are
 * consistent everywhere.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // URLs
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  WEB_BASE_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Database
  DATABASE_URL: z.string().url(),

  // JWT / crypto secrets (require strong secrets in production)
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  JWT_ISSUER: z.string().default('studyshare'),
  JWT_AUDIENCE: z.string().default('studyshare-web'),
  COOKIE_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),

  // Cookies
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // Google OAuth (optional — feature disabled if unset)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_PATH: z.string().default('/api/auth/google/callback'),

  // SMTP (Mailhog by default in dev)
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('StudyShare <no-reply@studyshare.local>'),

  // Object storage (MinIO / S3)
  S3_ENDPOINT: z.string().url().default('http://localhost:9000'),
  // Endpoint used when *signing* URLs the browser will open directly. In Docker
  // the API reaches MinIO at http://minio:9000 (S3_ENDPOINT), but the browser
  // can't resolve that host — set this to the host-reachable URL (e.g.
  // http://localhost:9000) so signed download/preview URLs actually work.
  S3_PUBLIC_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin'),
  S3_BUCKET: z.string().default('studyshare'),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  DOWNLOAD_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  // Uploads
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024),
  USER_STORAGE_QUOTA_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(500 * 1024 * 1024),

  // Rate limits
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_GLOBAL_WINDOW: z.string().default('1 minute'),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_AUTH_WINDOW: z.string().default('1 minute'),
  RATE_LIMIT_UPLOAD_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_UPLOAD_WINDOW: z.string().default('1 minute'),

  // Error reporting (Sentry-ready; disabled if unset)
  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    console.error(`\n✖ Invalid environment configuration:\n${issues}\n`);
    process.exit(1);
  }
  const value = parsed.data;

  // Extra guardrails for production.
  if (value.NODE_ENV === 'production') {
    const weak = [value.JWT_ACCESS_SECRET, value.JWT_REFRESH_SECRET, value.COOKIE_SECRET];
    if (weak.some((s) => /change|secret|example|dev/i.test(s))) {
      console.error('✖ Refusing to boot in production with placeholder secrets.');
      process.exit(1);
    }
    if (!value.COOKIE_SECURE) {
      console.warn('⚠ COOKIE_SECURE is false in production — cookies will not be Secure.');
    }
  }
  return value;
}

export const env: Env = loadEnv();

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const googleOAuthEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
