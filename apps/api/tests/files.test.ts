import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import FormData from 'form-data';
import { getTestApp, closeTestApp, resetDb, createUser, signAccessToken } from './helpers.js';

const PDF = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF', 'latin1');
const ELF = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00]);

function multipart(buffer: Buffer, filename: string, contentType: string) {
  const form = new FormData();
  form.append('file', buffer, { filename, contentType });
  return { payload: form.getBuffer(), headers: form.getHeaders() };
}

describe('file upload', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await getTestApp();
    await resetDb(app);
  });
  afterAll(closeTestApp);

  it('accepts a valid PDF from a verified user and stores a FileObject', async () => {
    const { user } = await createUser(app, { emailVerified: true });
    const token = signAccessToken(app, user);
    const { payload, headers } = multipart(PDF, 'lesson.pdf', 'application/pdf');

    const res = await app.inject({
      method: 'POST',
      url: '/api/files',
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.fileId).toBeTruthy();
    expect(body.checksum).toHaveLength(64);
    const file = await app.prisma.fileObject.findUnique({ where: { id: body.fileId } });
    expect(file?.storageKey).toMatch(/\.pdf$/);
    expect(file?.storageKey).not.toContain('lesson'); // random key, not original name
  });

  it('rejects an unverified user', async () => {
    const { user } = await createUser(app, { emailVerified: false });
    const token = signAccessToken(app, user);
    const { payload, headers } = multipart(PDF, 'lesson.pdf', 'application/pdf');
    const res = await app.inject({
      method: 'POST',
      url: '/api/files',
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('AUTH_EMAIL_NOT_VERIFIED');
  });

  it('rejects a renamed executable (magic-byte mismatch) over HTTP', async () => {
    const { user } = await createUser(app, { emailVerified: true });
    const token = signAccessToken(app, user);
    const { payload, headers } = multipart(ELF, 'malware.pdf', 'application/pdf');
    const res = await app.inject({
      method: 'POST',
      url: '/api/files',
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload,
    });
    expect(res.statusCode).toBe(415);
    expect(res.json().error.code).toBe('FILE_CONTENT_MISMATCH');
  });

  it('requires authentication', async () => {
    const { payload, headers } = multipart(PDF, 'lesson.pdf', 'application/pdf');
    const res = await app.inject({ method: 'POST', url: '/api/files', headers, payload });
    expect(res.statusCode).toBe(401);
  });
});
