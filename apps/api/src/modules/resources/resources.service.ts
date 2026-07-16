import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import {
  ErrorCode,
  ROLE_RANK,
  Role,
  type ListResourcesQuery,
  type CreateResourceInput,
} from '@studyshare/shared';
import { AppError, Errors } from '../../lib/errors.js';
import type { AuthenticatedUser } from '../../plugins/auth.js';

const RESOURCE_INCLUDE = { uploader: true, file: true } satisfies Prisma.ResourceInclude;

function isElevated(user?: AuthenticatedUser): boolean {
  return !!user && ROLE_RANK[user.role] >= ROLE_RANK[Role.MODERATOR];
}

// ---- Cursor helpers (keyset pagination) ----
interface Cursor {
  v: string;
  id: string;
}
function encodeCursor(v: string | number, id: string): string {
  return Buffer.from(JSON.stringify({ v: String(v), id })).toString('base64url');
}
function decodeCursor(cursor?: string): Cursor | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof parsed.v === 'string' && typeof parsed.id === 'string') return parsed;
  } catch {
    /* ignore malformed cursor */
  }
  return null;
}

const SORT_CONFIG = {
  newest: { col: 'r."createdAt"', cast: '::timestamptz', get: (r: { createdAt: Date }) => r.createdAt.toISOString() },
  downloads: { col: 'r."downloadsCount"', cast: '::int', get: (r: { downloadsCount: number }) => r.downloadsCount },
  rating: { col: 'r."avgRating"', cast: '::double precision', get: (r: { avgRating: number }) => r.avgRating },
} as const;

/**
 * List resources with filtering (branch/subject/type/minRating/status),
 * full-text search (Postgres tsvector), sorting, and keyset pagination.
 *
 * The candidate ids are selected via a single parameterized raw query (safe —
 * values are bound, never interpolated), then hydrated with Prisma so the
 * response shape stays consistent with the serializers.
 */
export async function listResources(
  app: FastifyInstance,
  query: ListResourcesQuery,
  viewer?: AuthenticatedUser,
) {
  const sort = SORT_CONFIG[query.sort];
  const params: unknown[] = [];
  const conds: string[] = ['r."deletedAt" IS NULL'];
  const push = (v: unknown): string => {
    params.push(v);
    return `$${params.length}`;
  };

  // Visibility: non-elevated viewers only ever see APPROVED. Elevated viewers
  // may request a specific status (e.g. PENDING for the moderation queue).
  if (isElevated(viewer) && query.status) {
    conds.push(`r."status" = ${push(query.status)}::"ResourceStatus"`);
  } else {
    conds.push(`r."status" = 'APPROVED'`);
  }

  if (query.branchId) conds.push(`r."branchId" = ${push(query.branchId)}`);
  if (query.subjectId) conds.push(`r."subjectId" = ${push(query.subjectId)}`);
  if (query.type) conds.push(`r."type" = ${push(query.type)}::"ResourceType"`);
  if (query.minRating) conds.push(`r."avgRating" >= ${push(query.minRating)}`);
  if (query.q) {
    conds.push(`r."searchVector" @@ plainto_tsquery('simple', ${push(query.q)})`);
  }

  const cursor = decodeCursor(query.cursor);
  if (cursor) {
    // Keyset: everything strictly "after" the cursor in DESC order.
    conds.push(
      `(${sort.col}, r."id") < (${push(cursor.v)}${sort.cast}, ${push(cursor.id)})`,
    );
  }

  const limit = query.limit;
  const sql = `
    SELECT r."id"
    FROM "Resource" r
    WHERE ${conds.join(' AND ')}
    ORDER BY ${sort.col} DESC, r."id" DESC
    LIMIT ${push(limit + 1)}
  `;

  const rows = await app.prisma.$queryRawUnsafe<{ id: string }[]>(sql, ...params);
  const ids = rows.slice(0, limit).map((r) => r.id);

  const records = await app.prisma.resource.findMany({
    where: { id: { in: ids } },
    include: RESOURCE_INCLUDE,
  });
  // Preserve the SQL ordering (findMany does not guarantee input order).
  const byId = new Map(records.map((r) => [r.id, r]));
  const ordered = ids.map((id) => byId.get(id)!).filter(Boolean);

  let nextCursor: string | null = null;
  if (rows.length > limit && ordered.length > 0) {
    const last = ordered[ordered.length - 1]!;
    nextCursor = encodeCursor(sort.get(last), last.id);
  }

  return { items: ordered, nextCursor };
}

/** Fetch a single resource, enforcing visibility (PENDING hidden from public). */
export async function getResourceOrThrow(
  app: FastifyInstance,
  id: string,
  viewer?: AuthenticatedUser,
) {
  const resource = await app.prisma.resource.findFirst({
    where: { id, deletedAt: null },
    include: RESOURCE_INCLUDE,
  });
  if (!resource) throw Errors.notFound();

  const canSeeNonApproved =
    isElevated(viewer) || (viewer && viewer.id === resource.uploaderId);
  if (resource.status !== 'APPROVED' && !canSeeNonApproved) {
    // Hide existence entirely for unauthorized viewers.
    throw Errors.notFound();
  }
  return resource;
}

export async function createResource(
  app: FastifyInstance,
  input: CreateResourceInput,
  uploaderId: string,
) {
  // The file must exist and belong to the uploader (prevents attaching others' files).
  const file = await app.prisma.fileObject.findFirst({
    where: { id: input.fileId, uploaderId },
  });
  if (!file) throw new AppError({ statusCode: 400, code: ErrorCode.FILE_MISSING });

  // The file may only back a single resource.
  const taken = await app.prisma.resource.findUnique({ where: { fileId: input.fileId } });
  if (taken) throw Errors.conflict();

  // Validate branch/subject consistency.
  const subject = await app.prisma.subject.findFirst({
    where: { id: input.subjectId, branchId: input.branchId },
  });
  if (!subject) throw new AppError({ statusCode: 400, code: ErrorCode.VALIDATION_ERROR });

  return app.prisma.resource.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      branchId: input.branchId,
      subjectId: input.subjectId,
      uploaderId,
      fileId: input.fileId,
      status: 'PENDING',
    },
    include: RESOURCE_INCLUDE,
  });
}
