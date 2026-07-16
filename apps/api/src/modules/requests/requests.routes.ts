import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  Permission,
  resourceRequestSchema,
  createRequestSchema,
  fulfillRequestSchema,
  listRequestsQuerySchema,
  paginated,
} from '@studyshare/shared';
import {
  listRequests,
  voteRequest,
  unvoteRequest,
  fulfillRequest,
} from './requests.service.js';
import { serializeRequest } from '../../lib/serializers.js';
import { AuditAction } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';

export const requestRoutes: FastifyPluginAsyncZod = async (app) => {
  // List / sort by most-requested (public; auth marks viewer votes).
  app.get(
    '/',
    {
      onRequest: app.optionalAuth,
      schema: {
        tags: ['requests'],
        querystring: listRequestsQuerySchema,
        response: { 200: paginated(resourceRequestSchema) },
      },
    },
    async (req) => {
      const { items, nextCursor, votedSet } = await listRequests(app, req.query, req.authUser?.id);
      return {
        items: items.map((r) => serializeRequest(r, votedSet.has(r.id))),
        nextCursor,
      };
    },
  );

  app.get(
    '/:id',
    {
      onRequest: app.optionalAuth,
      schema: {
        tags: ['requests'],
        params: z.object({ id: z.string() }),
        response: { 200: resourceRequestSchema },
      },
    },
    async (req) => {
      const request = await app.prisma.resourceRequest.findUnique({
        where: { id: req.params.id },
        include: { requester: true },
      });
      if (!request) throw Errors.notFound();
      const voted = req.authUser
        ? !!(await app.prisma.requestVote.findUnique({
            where: { requestId_userId: { requestId: request.id, userId: req.authUser.id } },
          }))
        : false;
      return serializeRequest(request, voted);
    },
  );

  // Create a request (verified users).
  app.post(
    '/',
    {
      onRequest: app.requireVerified,
      preHandler: app.authorize(Permission.REQUEST_CREATE),
      schema: {
        tags: ['requests'],
        body: createRequestSchema,
        response: { 201: resourceRequestSchema },
      },
    },
    async (req, reply) => {
      const subject = await app.prisma.subject.findFirst({
        where: { id: req.body.subjectId, branchId: req.body.branchId },
      });
      if (!subject) throw Errors.validation();
      const request = await app.prisma.resourceRequest.create({
        data: {
          title: req.body.title,
          description: req.body.description ?? null,
          type: req.body.type,
          branchId: req.body.branchId,
          subjectId: req.body.subjectId,
          requesterId: req.authUser!.id,
        },
        include: { requester: true },
      });
      await req.audit(AuditAction.REQUEST_CREATE, { targetType: 'request', targetId: request.id });
      return reply.code(201).send(serializeRequest(request, false));
    },
  );

  // Upvote / remove upvote.
  app.post(
    '/:id/vote',
    {
      onRequest: app.authenticate,
      preHandler: app.authorize(Permission.REQUEST_VOTE),
      schema: {
        tags: ['requests'],
        params: z.object({ id: z.string() }),
        response: { 200: z.object({ votesCount: z.number() }) },
      },
    },
    async (req) => {
      const votesCount = await voteRequest(app, req.params.id, req.authUser!.id);
      return { votesCount };
    },
  );

  app.delete(
    '/:id/vote',
    {
      onRequest: app.authenticate,
      preHandler: app.authorize(Permission.REQUEST_VOTE),
      schema: {
        tags: ['requests'],
        params: z.object({ id: z.string() }),
        response: { 200: z.object({ votesCount: z.number() }) },
      },
    },
    async (req) => {
      const votesCount = await unvoteRequest(app, req.params.id, req.authUser!.id);
      return { votesCount };
    },
  );

  // Fulfill a request by linking an approved resource.
  app.post(
    '/:id/fulfill',
    {
      onRequest: app.requireVerified,
      preHandler: app.authorize(Permission.REQUEST_FULFILL),
      schema: {
        tags: ['requests'],
        params: z.object({ id: z.string() }),
        body: fulfillRequestSchema,
        response: { 200: resourceRequestSchema },
      },
    },
    async (req) => {
      const updated = await fulfillRequest(
        app,
        req.params.id,
        req.body.resourceId,
        req.authUser!.id,
      );
      await req.audit(AuditAction.REQUEST_FULFILL, {
        targetType: 'request',
        targetId: updated.id,
        metadata: { resourceId: req.body.resourceId },
      });
      return serializeRequest(updated, false);
    },
  );
};
