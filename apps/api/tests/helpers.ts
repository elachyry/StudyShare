import type { FastifyInstance } from 'fastify';
import argon2 from 'argon2';
import { buildApp } from '../src/app.js';

let app: FastifyInstance | null = null;

/** Build (once per worker) and return the Fastify app for `inject()` tests. */
export async function getTestApp(): Promise<FastifyInstance> {
  if (!app) {
    app = await buildApp();
    await app.ready();
  }
  return app;
}

export async function closeTestApp(): Promise<void> {
  if (app) {
    await app.close();
    app = null;
  }
}

/** Truncate every table in the test schema between tests. */
export async function resetDb(instance: FastifyInstance): Promise<void> {
  const rows = await instance.prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'test'
  `;
  const tables = rows
    .map((r) => `"test"."${r.tablename}"`)
    .filter((t) => !t.includes('_prisma_migrations'));
  if (tables.length > 0) {
    await instance.prisma.$executeRawUnsafe(
      `TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`,
    );
  }
}

/** Create a user directly in the DB (bypassing signup) for test setup. */
export async function createUser(
  instance: FastifyInstance,
  overrides: Partial<{
    email: string;
    password: string;
    name: string;
    role: 'STUDENT' | 'MODERATOR' | 'ADMIN';
    emailVerified: boolean;
    status: 'ACTIVE' | 'SUSPENDED';
  }> = {},
) {
  const password = overrides.password ?? 'Str0ng!Passw0rd';
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const user = await instance.prisma.user.create({
    data: {
      email: overrides.email ?? `user-${Math.random().toString(36).slice(2)}@test.local`,
      name: overrides.name ?? 'Test User',
      passwordHash,
      role: overrides.role ?? 'STUDENT',
      emailVerified: overrides.emailVerified ?? true,
      status: overrides.status ?? 'ACTIVE',
    },
  });
  return { user, password };
}

/** Sign an access token for a user (skips the full login flow). */
export function signAccessToken(
  instance: FastifyInstance,
  user: { id: string; role: string; emailVerified: boolean },
): string {
  return instance.jwt.sign({
    sub: user.id,
    role: user.role as 'STUDENT' | 'MODERATOR' | 'ADMIN',
    emailVerified: user.emailVerified,
  });
}

/** Authorization header helper. */
export function authHeader(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}
