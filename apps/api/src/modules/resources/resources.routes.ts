import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  Permission,
  NotificationType,
  resourceSchema,
  createResourceSchema,
  updateResourceSchema,
  moderateResourceSchema,
  listResourcesQuerySchema,
  downloadUrlSchema,
  createRatingSchema,
  commentSchema,
  createCommentSchema,
  paginated,
  okSchema,
} from '@studyshare/shared';
import {
  listResources,
  getResourceOrThrow,
  createResource,
} from './resources.service.js';
import { rateResource } from './ratings.service.js';
import { serializeResource, serializeComment } from '../../lib/serializers.js';
import { assertOwnership } from '../../plugins/rbac.js';
import { getDownloadUrl } from '../../lib/storage.js';
import { notify } from '../../lib/notifications.js';
import { AuditAction } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';

export const resourceRoutes: FastifyPluginAsyncZod = async (app) => {
  // --- List / search (public; optional auth widens visibility) ---
  app.get(
    '/',
    {
      onRequest: app.optionalAuth,
      schema: {
        tags: ['resources'],
        querystring: listResourcesQuerySchema,
        response: { 200: paginated(resourceSchema) },
      },
    },
    async (req) => {
      const { items, nextCursor } = await listResources(app, req.query, req.authUser);
      return { items: items.map(serializeResource), nextCursor };
    },
  );

  // --- Current user's own uploads (any status) ---
  app.get(
    '/mine',
    {
      onRequest: app.authenticate,
      schema: { tags: ['resources'], response: { 200: z.array(resourceSchema) } },
    },
    async (req) => {
      const rows = await app.prisma.resource.findMany({
        where: { uploaderId: req.authUser!.id, deletedAt: null },
        include: { uploader: true, file: true },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map(serializeResource);
    },
  );

  // --- Create (verified users) ---
  app.post(
    '/',
    {
      onRequest: app.requireVerified,
      preHandler: app.authorize(Permission.RESOURCE_CREATE),
      schema: { tags: ['resources'], body: createResourceSchema, response: { 201: resourceSchema } },
    },
    async (req, reply) => {
      const resource = await createResource(app, req.body, req.authUser!.id);
      await req.audit(AuditAction.RESOURCE_CREATE, {
        targetType: 'resource',
        targetId: resource.id,
      });
      return reply.code(201).send(serializeResource(resource));
    },
  );

  // --- Get one ---
  app.get(
    '/:id',
    {
      onRequest: app.optionalAuth,
      schema: {
        tags: ['resources'],
        params: z.object({ id: z.string() }),
        response: { 200: resourceSchema },
      },
    },
    async (req) => {
      const resource = await getResourceOrThrow(app, req.params.id, req.authUser);
      return serializeResource(resource);
    },
  );

  // --- Update (owner or elevated) ---
  app.patch(
    '/:id',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['resources'],
        params: z.object({ id: z.string() }),
        body: updateResourceSchema,
        response: { 200: resourceSchema },
      },
    },
    async (req) => {
      const existing = await app.prisma.resource.findFirst({
        where: { id: req.params.id, deletedAt: null },
      });
      if (!existing) throw Errors.notFound();
      assertOwnership({ actor: req.authUser!, ownerId: existing.uploaderId });

      const updated = await app.prisma.resource.update({
        where: { id: existing.id },
        data: req.body,
        include: { uploader: true, file: true },
      });
      await req.audit(AuditAction.RESOURCE_UPDATE, {
        targetType: 'resource',
        targetId: updated.id,
      });
      return serializeResource(updated);
    },
  );

  // --- Delete (owner or elevated) — soft delete ---
  app.delete(
    '/:id',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['resources'],
        params: z.object({ id: z.string() }),
        response: { 200: okSchema },
      },
    },
    async (req) => {
      const existing = await app.prisma.resource.findFirst({
        where: { id: req.params.id, deletedAt: null },
      });
      if (!existing) throw Errors.notFound();
      assertOwnership({ actor: req.authUser!, ownerId: existing.uploaderId });

      await app.prisma.resource.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() },
      });
      await req.audit(AuditAction.RESOURCE_DELETE, {
        targetType: 'resource',
        targetId: existing.id,
      });
      return { ok: true as const };
    },
  );

  // --- Moderate (approve / reject) ---
  app.post(
    '/:id/moderate',
    {
      preHandler: app.authorize(Permission.RESOURCE_MODERATE),
      schema: {
        tags: ['resources'],
        params: z.object({ id: z.string() }),
        body: moderateResourceSchema,
        response: { 200: resourceSchema },
      },
    },
    async (req) => {
      const existing = await app.prisma.resource.findFirst({
        where: { id: req.params.id, deletedAt: null },
      });
      if (!existing) throw Errors.notFound();

      const approve = req.body.decision === 'APPROVE';
      const updated = await app.prisma.resource.update({
        where: { id: existing.id },
        data: {
          status: approve ? 'APPROVED' : 'REJECTED',
          moderationNote: req.body.reason ?? null,
        },
        include: { uploader: true, file: true },
      });

      await notify(app.prisma, {
        userId: existing.uploaderId,
        type: approve ? NotificationType.RESOURCE_APPROVED : NotificationType.RESOURCE_REJECTED,
        payload: { resourceId: existing.id, title: existing.title, reason: req.body.reason ?? null },
      });
      await req.audit(approve ? AuditAction.RESOURCE_APPROVE : AuditAction.RESOURCE_REJECT, {
        targetType: 'resource',
        targetId: existing.id,
        metadata: { reason: req.body.reason ?? null },
      });
      return serializeResource(updated);
    },
  );

  // --- Download (signed URL; authenticated + audited) ---
  app.get(
    '/:id/download',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['resources'],
        params: z.object({ id: z.string() }),
        response: { 200: downloadUrlSchema },
      },
    },
    async (req) => {
      const resource = await getResourceOrThrow(app, req.params.id, req.authUser);
      const url = await getDownloadUrl(resource.file.storageKey, resource.file.originalName);
      await app.prisma.resource.update({
        where: { id: resource.id },
        data: { downloadsCount: { increment: 1 } },
      });
      await req.audit(AuditAction.FILE_DOWNLOAD, {
        targetType: 'resource',
        targetId: resource.id,
        metadata: { fileId: resource.fileId },
      });
      return url;
    },
  );

  // --- Rate (upsert; verified users) ---
  app.put(
    '/:id/rating',
    {
      onRequest: app.requireVerified,
      preHandler: app.authorize(Permission.RATING_CREATE),
      schema: {
        tags: ['resources'],
        params: z.object({ id: z.string() }),
        body: createRatingSchema,
        response: { 200: z.object({ averageRating: z.number(), ratingsCount: z.number() }) },
      },
    },
    async (req) => {
      const resource = await getResourceOrThrow(app, req.params.id, req.authUser);
      const { avgRating, ratingsCount } = await rateResource(
        app,
        resource.id,
        req.authUser!.id,
        req.body.value,
      );
      return { averageRating: avgRating, ratingsCount };
    },
  );

  // --- Comments: list ---
  app.get(
    '/:id/comments',
    {
      schema: {
        tags: ['resources'],
        params: z.object({ id: z.string() }),
        response: { 200: z.array(commentSchema) },
      },
    },
    async (req) => {
      const comments = await app.prisma.comment.findMany({
        where: { resourceId: req.params.id },
        include: { user: true },
        orderBy: { createdAt: 'asc' },
      });
      return comments.map(serializeComment);
    },
  );

  // --- Comments: create (notifies the resource owner) ---
  app.post(
    '/:id/comments',
    {
      onRequest: app.requireVerified,
      preHandler: app.authorize(Permission.COMMENT_CREATE),
      schema: {
        tags: ['resources'],
        params: z.object({ id: z.string() }),
        body: createCommentSchema,
        response: { 201: commentSchema },
      },
    },
    async (req, reply) => {
      const resource = await getResourceOrThrow(app, req.params.id, req.authUser);
      const comment = await app.prisma.comment.create({
        data: { resourceId: resource.id, userId: req.authUser!.id, body: req.body.body },
        include: { user: true },
      });
      if (resource.uploaderId !== req.authUser!.id) {
        await notify(app.prisma, {
          userId: resource.uploaderId,
          type: NotificationType.NEW_COMMENT,
          payload: { resourceId: resource.id, title: resource.title, commentId: comment.id },
        });
      }
      return reply.code(201).send(serializeComment(comment));
    },
  );

  // --- Comments: delete (own) or hide (moderator) ---
  app.delete(
    '/comments/:commentId',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['resources'],
        params: z.object({ commentId: z.string() }),
        response: { 200: okSchema },
      },
    },
    async (req) => {
      const comment = await app.prisma.comment.findUnique({
        where: { id: req.params.commentId },
      });
      if (!comment || comment.deletedAt) throw Errors.notFound();
      assertOwnership({ actor: req.authUser!, ownerId: comment.userId });

      const isModerator = req.authUser!.id !== comment.userId;
      await app.prisma.comment.update({
        where: { id: comment.id },
        data: { deletedAt: new Date() },
      });
      if (isModerator) {
        await req.audit(AuditAction.COMMENT_HIDE, {
          targetType: 'comment',
          targetId: comment.id,
        });
      }
      return { ok: true as const };
    },
  );
};
