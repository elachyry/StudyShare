import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getTestApp, closeTestApp, resetDb, createUser, signAccessToken, authHeader } from './helpers.js';

/** Seed a branch + subject and return their ids. */
async function seedTaxonomy(app: FastifyInstance) {
  const branch = await app.prisma.branch.create({
    data: { name: 'CS', nameFr: 'Info', slug: `cs-${Math.random().toString(36).slice(2, 8)}` },
  });
  const subject = await app.prisma.subject.create({
    data: { branchId: branch.id, name: 'Algo', nameFr: 'Algo', slug: 'algo' },
  });
  return { branchId: branch.id, subjectId: subject.id };
}

/** Create a FileObject row (as if uploaded) for a user. */
async function seedFile(app: FastifyInstance, uploaderId: string) {
  return app.prisma.fileObject.create({
    data: {
      storageKey: `${Math.random().toString(36).slice(2)}.pdf`,
      originalName: 'notes.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1234,
      checksum: 'a'.repeat(64),
      uploaderId,
      scanned: true,
    },
  });
}

describe('resources', () => {
  let app: FastifyInstance;
  beforeEach(async () => {
    app = await getTestApp();
    await resetDb(app);
  });
  afterAll(closeTestApp);

  it('creates a PENDING resource, hidden from the public list until approved', async () => {
    const { user } = await createUser(app, { emailVerified: true });
    const token = signAccessToken(app, user);
    const { branchId, subjectId } = await seedTaxonomy(app);
    const file = await seedFile(app, user.id);

    const created = await app.inject({
      method: 'POST',
      url: '/api/resources',
      headers: authHeader(token),
      payload: { title: 'Sorting Notes', type: 'LESSON', branchId, subjectId, fileId: file.id },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().status).toBe('PENDING');

    // Public list excludes PENDING.
    const publicList = await app.inject({ method: 'GET', url: '/api/resources' });
    expect(publicList.json().items).toHaveLength(0);

    // Owner sees it via /mine.
    const mine = await app.inject({ method: 'GET', url: '/api/resources/mine', headers: authHeader(token) });
    expect(mine.json()).toHaveLength(1);
  });

  it('enforces upload ownership: cannot attach another user file', async () => {
    const { user: owner } = await createUser(app, { emailVerified: true });
    const { user: other } = await createUser(app, { emailVerified: true });
    const otherToken = signAccessToken(app, other);
    const { branchId, subjectId } = await seedTaxonomy(app);
    const file = await seedFile(app, owner.id);

    const res = await app.inject({
      method: 'POST',
      url: '/api/resources',
      headers: authHeader(otherToken),
      payload: { title: 'Stolen', type: 'LESSON', branchId, subjectId, fileId: file.id },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('FILE_MISSING');
  });

  it('moderates, then the resource is searchable and downloadable', async () => {
    const { user } = await createUser(app, { emailVerified: true });
    const { user: mod } = await createUser(app, { role: 'MODERATOR', emailVerified: true });
    const token = signAccessToken(app, user);
    const modToken = signAccessToken(app, mod);
    const { branchId, subjectId } = await seedTaxonomy(app);
    const file = await seedFile(app, user.id);

    const created = await app.inject({
      method: 'POST',
      url: '/api/resources',
      headers: authHeader(token),
      payload: {
        title: 'Dijkstra shortest path',
        description: 'graph algorithms',
        type: 'LESSON',
        branchId,
        subjectId,
        fileId: file.id,
      },
    });
    const id = created.json().id;

    // A student cannot moderate.
    const denied = await app.inject({
      method: 'POST',
      url: `/api/resources/${id}/moderate`,
      headers: authHeader(token),
      payload: { decision: 'APPROVE' },
    });
    expect(denied.statusCode).toBe(403);

    // Moderator approves.
    const approved = await app.inject({
      method: 'POST',
      url: `/api/resources/${id}/moderate`,
      headers: authHeader(modToken),
      payload: { decision: 'APPROVE' },
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().status).toBe('APPROVED');

    // Full-text search finds it — by whole word AND by prefix (as typed).
    const search = await app.inject({ method: 'GET', url: '/api/resources?q=dijkstra' });
    expect(search.json().items).toHaveLength(1);
    const partial = await app.inject({ method: 'GET', url: '/api/resources?q=dijk' });
    expect(partial.json().items).toHaveLength(1);
    const partialWord = await app.inject({ method: 'GET', url: '/api/resources?q=short' });
    expect(partialWord.json().items).toHaveLength(1);

    // The owner was notified.
    const notes = await app.prisma.notification.findMany({ where: { userId: user.id } });
    expect(notes.some((n) => n.type === 'RESOURCE_APPROVED')).toBe(true);
  });

  it('rates a resource and updates the aggregate', async () => {
    const { user } = await createUser(app, { emailVerified: true });
    const { user: rater } = await createUser(app, { emailVerified: true });
    const raterToken = signAccessToken(app, rater);
    const { branchId, subjectId } = await seedTaxonomy(app);
    const file = await seedFile(app, user.id);
    const resource = await app.prisma.resource.create({
      data: { title: 'R', type: 'LESSON', status: 'APPROVED', branchId, subjectId, uploaderId: user.id, fileId: file.id },
    });

    const res = await app.inject({
      method: 'PUT',
      url: `/api/resources/${resource.id}/rating`,
      headers: authHeader(raterToken),
      payload: { value: 4 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().averageRating).toBe(4);
    expect(res.json().ratingsCount).toBe(1);
  });

  it('prevents IDOR: a student cannot delete another user resource', async () => {
    const { user: owner } = await createUser(app, { emailVerified: true });
    const { user: attacker } = await createUser(app, { emailVerified: true });
    const attackerToken = signAccessToken(app, attacker);
    const { branchId, subjectId } = await seedTaxonomy(app);
    const file = await seedFile(app, owner.id);
    const resource = await app.prisma.resource.create({
      data: { title: 'Victim', type: 'LESSON', status: 'APPROVED', branchId, subjectId, uploaderId: owner.id, fileId: file.id },
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/resources/${resource.id}`,
      headers: authHeader(attackerToken),
    });
    expect(res.statusCode).toBe(403);
  });
});
