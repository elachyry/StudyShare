import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getTestApp, closeTestApp, resetDb, createUser, signAccessToken, authHeader } from './helpers.js';

async function seedTaxonomy(app: FastifyInstance) {
  const branch = await app.prisma.branch.create({
    data: { name: 'CS', nameFr: 'Info', slug: `cs-${Math.random().toString(36).slice(2, 8)}` },
  });
  const subject = await app.prisma.subject.create({
    data: { branchId: branch.id, name: 'DB', nameFr: 'BD', slug: 'db' },
  });
  return { branchId: branch.id, subjectId: subject.id };
}

describe('request board', () => {
  let app: FastifyInstance;
  beforeEach(async () => {
    app = await getTestApp();
    await resetDb(app);
  });
  afterAll(closeTestApp);

  it('creates, upvotes (once), and fulfills a request with a notification', async () => {
    const { user: requester } = await createUser(app, { emailVerified: true });
    const { user: helper } = await createUser(app, { emailVerified: true });
    const reqToken = signAccessToken(app, requester);
    const helperToken = signAccessToken(app, helper);
    const { branchId, subjectId } = await seedTaxonomy(app);

    // Create a request.
    const created = await app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: authHeader(reqToken),
      payload: { title: 'Need B-Tree summary', type: 'SUMMARY', branchId, subjectId },
    });
    expect(created.statusCode).toBe(201);
    const requestId = created.json().id;

    // Helper upvotes; a second vote is rejected as duplicate.
    const vote1 = await app.inject({
      method: 'POST',
      url: `/api/requests/${requestId}/vote`,
      headers: authHeader(helperToken),
    });
    expect(vote1.json().votesCount).toBe(1);
    const vote2 = await app.inject({
      method: 'POST',
      url: `/api/requests/${requestId}/vote`,
      headers: authHeader(helperToken),
    });
    expect(vote2.statusCode).toBe(409);

    // Helper uploads + gets an approved resource, then fulfills the request.
    const file = await app.prisma.fileObject.create({
      data: {
        storageKey: `${Math.random().toString(36).slice(2)}.pdf`,
        originalName: 'summary.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 100,
        checksum: 'b'.repeat(64),
        uploaderId: helper.id,
        scanned: true,
      },
    });
    const resource = await app.prisma.resource.create({
      data: { title: 'B-Tree summary', type: 'SUMMARY', status: 'APPROVED', branchId, subjectId, uploaderId: helper.id, fileId: file.id },
    });

    const fulfill = await app.inject({
      method: 'POST',
      url: `/api/requests/${requestId}/fulfill`,
      headers: authHeader(helperToken),
      payload: { resourceId: resource.id },
    });
    expect(fulfill.statusCode).toBe(200);
    expect(fulfill.json().status).toBe('FULFILLED');
    expect(fulfill.json().fulfilledByResourceId).toBe(resource.id);

    // The requester was notified.
    const notes = await app.prisma.notification.findMany({ where: { userId: requester.id } });
    expect(notes.some((n) => n.type === 'REQUEST_FULFILLED')).toBe(true);

    // Fulfilling again is a conflict.
    const again = await app.inject({
      method: 'POST',
      url: `/api/requests/${requestId}/fulfill`,
      headers: authHeader(helperToken),
      payload: { resourceId: resource.id },
    });
    expect(again.statusCode).toBe(409);
  });

  it('sorts by most-requested', async () => {
    const { user } = await createUser(app, { emailVerified: true });
    const { user: voter } = await createUser(app, { emailVerified: true });
    const token = signAccessToken(app, user);
    const voterToken = signAccessToken(app, voter);
    const { branchId, subjectId } = await seedTaxonomy(app);

    const a = await app.inject({ method: 'POST', url: '/api/requests', headers: authHeader(token), payload: { title: 'Alpha request', type: 'LESSON', branchId, subjectId } });
    const b = await app.inject({ method: 'POST', url: '/api/requests', headers: authHeader(token), payload: { title: 'Bravo request', type: 'LESSON', branchId, subjectId } });
    expect(a.statusCode).toBe(201);
    expect(b.statusCode).toBe(201);
    await app.inject({ method: 'POST', url: `/api/requests/${b.json().id}/vote`, headers: authHeader(voterToken) });

    const list = await app.inject({ method: 'GET', url: '/api/requests?sort=votes' });
    const titles = list.json().items.map((i: { title: string }) => i.title);
    expect(titles[0]).toBe('Bravo request');
  });
});
