import { afterAll, describe, expect, it } from 'vitest';
import { getTestApp, closeTestApp } from './helpers.js';

describe('health endpoints', () => {
  afterAll(closeTestApp);

  it('GET /health returns ok', async () => {
    const app = await getTestApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('GET /ready reports dependency checks', async () => {
    const app = await getTestApp();
    const res = await app.inject({ method: 'GET', url: '/ready' });
    const body = res.json();
    expect(body.checks.database).toBe(true);
    expect([200, 503]).toContain(res.statusCode);
  });
});
