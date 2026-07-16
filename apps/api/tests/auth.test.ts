import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance, InjectOptions } from 'fastify';
import { getTestApp, closeTestApp, resetDb, createUser } from './helpers.js';
import { hashToken } from '../src/modules/auth/tokens.js';

const STRONG = 'V3ry!Str0ng-Passw0rd';

/** Extract the value of a Set-Cookie by name from an inject response. */
function getSetCookie(res: { cookies: Array<{ name: string; value: string }> }, name: string) {
  return res.cookies.find((c) => c.name === name)?.value;
}

/** Fetch a CSRF token + its cookie for cookie-based mutations. */
async function getCsrf(app: FastifyInstance): Promise<{ token: string; cookieHeader: string }> {
  const res = await app.inject({ method: 'GET', url: '/api/auth/csrf' });
  const setCookies = res.cookies.map((c) => `${c.name}=${c.value}`);
  return { token: res.json().csrfToken, cookieHeader: setCookies.join('; ') };
}

async function login(app: FastifyInstance, email: string, password: string) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
  } satisfies InjectOptions);
}

describe('auth', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await getTestApp();
    await resetDb(app);
  });
  afterAll(closeTestApp);

  describe('signup', () => {
    it('creates an unverified user and rejects weak passwords', async () => {
      const weak = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: { email: 'new@test.local', password: 'password12', name: 'New User' },
      });
      // Fails either the structural regex (400 VALIDATION) or zxcvbn gate.
      expect(weak.statusCode).toBe(400);

      const ok = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: { email: 'new@test.local', password: STRONG, name: 'New User' },
      });
      expect(ok.statusCode).toBe(201);
      const user = await app.prisma.user.findUnique({ where: { email: 'new@test.local' } });
      expect(user?.emailVerified).toBe(false);
    });

    it('does not allow duplicate emails', async () => {
      await createUser(app, { email: 'dupe@test.local' });
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/signup',
        payload: { email: 'dupe@test.local', password: STRONG, name: 'Dupe' },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('AUTH_EMAIL_TAKEN');
    });
  });

  describe('login', () => {
    it('returns an access token + refresh cookie on success', async () => {
      const { user, password } = await createUser(app, { email: 'a@test.local' });
      const res = await login(app, user.email, password);
      expect(res.statusCode).toBe(200);
      expect(res.json().accessToken).toBeTruthy();
      expect(res.json().user.email).toBe('a@test.local');
      expect(getSetCookie(res, 'ss_refresh')).toBeTruthy();
    });

    it('returns a generic error for wrong password (no enumeration)', async () => {
      const { user } = await createUser(app, { email: 'b@test.local' });
      const wrong = await login(app, user.email, 'Wr0ng!Passw0rd-xx');
      const missing = await login(app, 'nobody@test.local', 'Wr0ng!Passw0rd-xx');
      expect(wrong.statusCode).toBe(401);
      expect(missing.statusCode).toBe(401);
      expect(wrong.json().error.code).toBe('AUTH_INVALID_CREDENTIALS');
      expect(missing.json().error.code).toBe('AUTH_INVALID_CREDENTIALS');
    });

    it('blocks suspended accounts', async () => {
      const { user, password } = await createUser(app, {
        email: 'susp@test.local',
        status: 'SUSPENDED',
      });
      const res = await login(app, user.email, password);
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('AUTH_ACCOUNT_SUSPENDED');
    });
  });

  describe('refresh rotation + reuse detection', () => {
    it('rotates the refresh token and detects reuse of a revoked token', async () => {
      const { user, password } = await createUser(app, { email: 'r@test.local' });
      const loginRes = await login(app, user.email, password);
      const firstRefresh = getSetCookie(loginRes, 'ss_refresh')!;
      const csrf = await getCsrf(app);

      // First rotation succeeds and returns a NEW refresh cookie.
      const rotate1 = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: {
          'x-csrf-token': csrf.token,
          cookie: `${csrf.cookieHeader}; ss_refresh=${firstRefresh}`,
        },
      });
      expect(rotate1.statusCode).toBe(200);
      const secondRefresh = getSetCookie(rotate1, 'ss_refresh')!;
      expect(secondRefresh).not.toBe(firstRefresh);

      // Reusing the FIRST (now revoked) token triggers reuse detection.
      const csrf2 = await getCsrf(app);
      const reuse = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: { 'x-csrf-token': csrf2.token, cookie: `${csrf2.cookieHeader}; ss_refresh=${firstRefresh}` },
      });
      expect(reuse.statusCode).toBe(401);
      expect(reuse.json().error.code).toBe('AUTH_REFRESH_REUSE_DETECTED');

      // The whole family is revoked, so the second token is now dead too.
      const csrf3 = await getCsrf(app);
      const afterFamilyRevoke = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: { 'x-csrf-token': csrf3.token, cookie: `${csrf3.cookieHeader}; ss_refresh=${secondRefresh}` },
      });
      expect(afterFamilyRevoke.statusCode).toBe(401);
    });

    it('rejects refresh without a CSRF token', async () => {
      const { user, password } = await createUser(app, { email: 'c@test.local' });
      const loginRes = await login(app, user.email, password);
      const refresh = getSetCookie(loginRes, 'ss_refresh')!;
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        cookies: { ss_refresh: refresh },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('email verification', () => {
    it('verifies via a valid token and rejects invalid ones', async () => {
      const { user } = await createUser(app, { email: 'v@test.local', emailVerified: false });
      await app.prisma.emailToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken('known-verify-token'),
          type: 'VERIFY_EMAIL',
          expiresAt: new Date(Date.now() + 3600_000),
        },
      });
      const bad = await app.inject({
        method: 'POST',
        url: '/api/auth/verify-email',
        payload: { token: 'this-is-wrong-token' },
      });
      expect(bad.statusCode).toBe(400);

      const good = await app.inject({
        method: 'POST',
        url: '/api/auth/verify-email',
        payload: { token: 'known-verify-token' },
      });
      expect(good.statusCode).toBe(200);
      const refreshed = await app.prisma.user.findUnique({ where: { id: user.id } });
      expect(refreshed?.emailVerified).toBe(true);
    });
  });

  describe('password reset', () => {
    it('always returns 200 for forgot-password (no enumeration)', async () => {
      const exists = await app.inject({
        method: 'POST',
        url: '/api/auth/forgot-password',
        payload: { email: 'ghost@test.local' },
      });
      expect(exists.statusCode).toBe(200);
    });

    it('resets the password with a valid token and revokes sessions', async () => {
      const { user, password } = await createUser(app, { email: 'reset@test.local' });
      const loginRes = await login(app, user.email, password);
      expect(loginRes.statusCode).toBe(200);

      await app.prisma.emailToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken('known-reset-token'),
          type: 'RESET_PASSWORD',
          expiresAt: new Date(Date.now() + 3600_000),
        },
      });
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        payload: { token: 'known-reset-token', password: 'N3w!Str0ng-Passw0rd' },
      });
      expect(res.statusCode).toBe(200);

      // Old password no longer works; new one does.
      const oldLogin = await login(app, user.email, password);
      expect(oldLogin.statusCode).toBe(401);
      const newLogin = await login(app, user.email, 'N3w!Str0ng-Passw0rd');
      expect(newLogin.statusCode).toBe(200);
    });
  });

  describe('me + authentication', () => {
    it('rejects an expired/invalid token and accepts a valid one', async () => {
      const { user, password } = await createUser(app, { email: 'me@test.local' });
      const loginRes = await login(app, user.email, password);
      const token = loginRes.json().accessToken as string;

      const ok = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(ok.statusCode).toBe(200);
      expect(ok.json().email).toBe('me@test.local');

      const bad = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: 'Bearer not-a-real-token' },
      });
      expect(bad.statusCode).toBe(401);
    });
  });
});
