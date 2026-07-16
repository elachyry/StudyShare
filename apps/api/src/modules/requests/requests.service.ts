import type { FastifyInstance } from 'fastify';
import { ErrorCode, NotificationType, type ListRequestsQuery } from '@studyshare/shared';
import { AppError, Errors } from '../../lib/errors.js';
import { notify } from '../../lib/notifications.js';

const REQUEST_INCLUDE = { requester: true } as const;

/** List requests with filters + sort (votes|newest) + keyset pagination. */
export async function listRequests(
  app: FastifyInstance,
  query: ListRequestsQuery,
  viewerId?: string,
) {
  const where = {
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.subjectId ? { subjectId: query.subjectId } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const orderBy =
    query.sort === 'votes'
      ? [{ votesCount: 'desc' as const }, { id: 'desc' as const }]
      : [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

  const rows = await app.prisma.resourceRequest.findMany({
    where,
    include: REQUEST_INCLUDE,
    orderBy,
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });

  const items = rows.slice(0, query.limit);
  const nextCursor = rows.length > query.limit ? (items[items.length - 1]?.id ?? null) : null;

  // Which of these the viewer has voted for.
  const votedSet = new Set<string>();
  if (viewerId && items.length > 0) {
    const votes = await app.prisma.requestVote.findMany({
      where: { userId: viewerId, requestId: { in: items.map((i) => i.id) } },
      select: { requestId: true },
    });
    votes.forEach((v) => votedSet.add(v.requestId));
  }

  return { items, nextCursor, votedSet };
}

/** Toggle-safe upvote (unique per user+request). Returns the new vote count. */
export async function voteRequest(
  app: FastifyInstance,
  requestId: string,
  userId: string,
): Promise<number> {
  const request = await app.prisma.resourceRequest.findUnique({ where: { id: requestId } });
  if (!request) throw Errors.notFound();

  return app.prisma.$transaction(async (tx) => {
    const existing = await tx.requestVote.findUnique({
      where: { requestId_userId: { requestId, userId } },
    });
    if (existing) {
      throw new AppError({ statusCode: 409, code: ErrorCode.ALREADY_VOTED });
    }
    await tx.requestVote.create({ data: { requestId, userId } });
    const updated = await tx.resourceRequest.update({
      where: { id: requestId },
      data: { votesCount: { increment: 1 } },
    });
    return updated.votesCount;
  });
}

export async function unvoteRequest(
  app: FastifyInstance,
  requestId: string,
  userId: string,
): Promise<number> {
  return app.prisma.$transaction(async (tx) => {
    const existing = await tx.requestVote.findUnique({
      where: { requestId_userId: { requestId, userId } },
    });
    if (!existing) {
      const req = await tx.resourceRequest.findUnique({ where: { id: requestId } });
      if (!req) throw Errors.notFound();
      return req.votesCount;
    }
    await tx.requestVote.delete({ where: { id: existing.id } });
    const updated = await tx.resourceRequest.update({
      where: { id: requestId },
      data: { votesCount: { decrement: 1 } },
    });
    return updated.votesCount;
  });
}

/**
 * Fulfill a request by linking an approved resource. Marks the request
 * FULFILLED, links it, and notifies the original requester.
 */
export async function fulfillRequest(
  app: FastifyInstance,
  requestId: string,
  resourceId: string,
  actorId: string,
) {
  const request = await app.prisma.resourceRequest.findUnique({ where: { id: requestId } });
  if (!request) throw Errors.notFound();
  if (request.status === 'FULFILLED') {
    throw new AppError({ statusCode: 409, code: ErrorCode.REQUEST_ALREADY_FULFILLED });
  }

  const resource = await app.prisma.resource.findFirst({
    where: { id: resourceId, deletedAt: null },
  });
  if (!resource) throw new AppError({ statusCode: 400, code: ErrorCode.VALIDATION_ERROR });
  if (resource.status !== 'APPROVED') {
    throw new AppError({ statusCode: 400, code: ErrorCode.RESOURCE_NOT_APPROVED });
  }

  const updated = await app.prisma.resourceRequest.update({
    where: { id: requestId },
    data: { status: 'FULFILLED', fulfilledByResourceId: resourceId },
    include: REQUEST_INCLUDE,
  });

  if (request.requesterId !== actorId) {
    await notify(app.prisma, {
      userId: request.requesterId,
      type: NotificationType.REQUEST_FULFILLED,
      payload: { requestId, resourceId, title: request.title },
    });
  }
  return updated;
}
