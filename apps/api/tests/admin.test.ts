import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getTestApp, closeTestApp, resetDb, createUser, signAccessToken, authHeader } from './helpers.js';

describe('admin', () => {
  let app: FastifyInstance;
  beforeEach(async () => {
    app = await getTestApp();
    await resetDb(app);
  });
  afterAll(closeTestApp);

  it('denies non-admins access to user management and audit logs', async () => {
    const { user: student } = await createUser(app, { role: 'STUDENT', emailVerified: true });
    const { user: mod } = await createUser(app, { role: 'MODERATOR', emailVerified: true });
    for (const u of [student, mod]) {
      const token = signAccessToken(app, u);
      expect((await app.inject({ method: 'GET', url: '/api/admin/users', headers: authHeader(token) })).statusCode).toBe(403);
      expect((await app.inject({ method: 'GET', url: '/api/admin/audit-logs', headers: authHeader(token) })).statusCode).toBe(403);
    }
  });

  it('lets an admin change a role and suspend a user, and records audit entries', async () => {
    const { user: admin } = await createUser(app, { role: 'ADMIN', emailVerified: true });
    const { user: target } = await createUser(app, { role: 'STUDENT', emailVerified: true });
    const adminToken = signAccessToken(app, admin);

    const role = await app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${target.id}/role`,
      headers: authHeader(adminToken),
      payload: { role: 'MODERATOR' },
    });
    expect(role.statusCode).toBe(200);
    expect(role.json().role).toBe('MODERATOR');

    const suspend = await app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${target.id}/status`,
      headers: authHeader(adminToken),
      payload: { status: 'SUSPENDED' },
    });
    expect(suspend.statusCode).toBe(200);

    // Audit log reflects both actions.
    const logs = await app.inject({ method: 'GET', url: '/api/admin/audit-logs', headers: authHeader(adminToken) });
    const actions = logs.json().items.map((l: { action: string }) => l.action);
    expect(actions).toContain('admin.user.role_changed');
    expect(actions).toContain('admin.user.suspended');

    // CSV export works.
    const csv = await app.inject({ method: 'GET', url: '/api/admin/audit-logs/export', headers: authHeader(adminToken) });
    expect(csv.statusCode).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.body).toContain('admin.user.role_changed');
  });

  it('prevents an admin from changing their own role', async () => {
    const { user: admin } = await createUser(app, { role: 'ADMIN', emailVerified: true });
    const adminToken = signAccessToken(app, admin);
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${admin.id}/role`,
      headers: authHeader(adminToken),
      payload: { role: 'STUDENT' },
    });
    expect(res.statusCode).toBe(409);
  });
});
