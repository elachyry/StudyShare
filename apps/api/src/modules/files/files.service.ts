import { randomUUID } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';
import { ErrorCode, type UploadedFile } from '@studyshare/shared';
import { AppError } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import { validateUpload } from '../../lib/upload-validation.js';
import { scanFile } from '../../lib/scan.js';
import { putObject } from '../../lib/storage.js';
import { sha256Hex } from '../auth/tokens.js';
import { AuditAction } from '../../lib/audit.js';

/**
 * Buffer a multipart file up to the configured limit. `@fastify/multipart` sets
 * `file.truncated` when the stream exceeds `limits.fileSize`; we treat that as a
 * hard rejection rather than silently storing a partial file.
 */
async function bufferFile(part: MultipartFile): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of part.file) chunks.push(chunk as Buffer);
  if (part.file.truncated) {
    throw new AppError({ statusCode: 413, code: ErrorCode.FILE_TOO_LARGE });
  }
  return Buffer.concat(chunks);
}

/**
 * Process an uploaded file end-to-end: enforce quota → buffer within the limit →
 * validate (allowlist + declared MIME + magic bytes) → checksum → scan → store
 * under a random key in the private bucket → persist a FileObject.
 *
 * The original filename is NEVER used as a storage key; it is kept only as
 * metadata. A random uuid + safe extension becomes the key.
 */
export async function processUpload(
  req: FastifyRequest,
  uploaderId: string,
): Promise<UploadedFile> {
  const prisma = req.server.prisma;

  const part = await req.file();
  if (!part) throw new AppError({ statusCode: 400, code: ErrorCode.FILE_MISSING });

  // Per-user storage quota (sum of prior uploads).
  const agg = await prisma.fileObject.aggregate({
    where: { uploaderId },
    _sum: { sizeBytes: true },
  });
  const used = agg._sum.sizeBytes ?? 0;

  const buffer = await bufferFile(part);

  if (used + buffer.length > env.USER_STORAGE_QUOTA_BYTES) {
    throw new AppError({ statusCode: 413, code: ErrorCode.FILE_QUOTA_EXCEEDED });
  }

  const { ext, mimeType } = await validateUpload({
    filename: part.filename,
    declaredMime: part.mimetype,
    buffer,
  });

  const checksum = sha256Hex(buffer);

  // Deduplicate: reuse an identical prior upload by the same user.
  const existing = await prisma.fileObject.findFirst({
    where: { checksum, uploaderId },
  });
  if (existing) {
    return {
      fileId: existing.id,
      originalName: existing.originalName,
      mimeType: existing.mimeType,
      sizeBytes: existing.sizeBytes,
      checksum: existing.checksum,
    };
  }

  const scan = await scanFile(buffer, req.log);
  if (!scan.clean) {
    throw new AppError({ statusCode: 422, code: ErrorCode.FILE_CONTENT_MISMATCH });
  }

  const storageKey = `${randomUUID()}.${ext}`;
  await putObject({
    key: storageKey,
    body: buffer,
    contentType: mimeType,
    originalName: part.filename,
  });

  const file = await prisma.fileObject.create({
    data: {
      storageKey,
      originalName: part.filename.slice(0, 255),
      mimeType,
      sizeBytes: buffer.length,
      checksum,
      uploaderId,
      scanned: scan.clean,
    },
  });

  await req.audit(AuditAction.FILE_UPLOAD, {
    targetType: 'file',
    targetId: file.id,
    metadata: { sizeBytes: file.sizeBytes, mimeType, checksum },
  });

  return {
    fileId: file.id,
    originalName: file.originalName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    checksum: file.checksum,
  };
}
