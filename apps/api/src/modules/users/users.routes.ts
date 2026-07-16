import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { randomUUID } from 'node:crypto';
import {
  updateProfileSchema,
  profileStatsSchema,
  authUserSchema,
  okSchema,
} from '@studyshare/shared';
import { toAuthUser } from '../auth/auth.service.js';
import { AuditAction } from '../../lib/audit.js';

/**
 * Profile management: view/update own profile, contribution stats, and
 * GDPR-style account deletion (soft delete + anonymization; a background purge
 * job can later hard-delete storage objects).
 */
export const userRoutes: FastifyPluginAsyncZod = async (app) => {
  app.patch(
    '/me',
    {
      onRequest: app.authenticate,
      schema: { tags: ['users'], body: updateProfileSchema, response: { 200: authUserSchema } },
    },
    async (req) => {
      const user = await app.prisma.user.update({
        where: { id: req.authUser!.id },
        data: {
          ...(req.body.name !== undefined ? { name: req.body.name } : {}),
          ...(req.body.branchId !== undefined ? { branchId: req.body.branchId } : {}),
        },
      });
      return toAuthUser(user);
    },
  );

  app.get(
    '/me/stats',
    {
      onRequest: app.authenticate,
      schema: { tags: ['users'], response: { 200: profileStatsSchema } },
    },
    async (req) => {
      const userId = req.authUser!.id;
      const [uploadsCount, approvedUploadsCount, requestsCount, downloads] = await Promise.all([
        app.prisma.resource.count({ where: { uploaderId: userId, deletedAt: null } }),
        app.prisma.resource.count({
          where: { uploaderId: userId, deletedAt: null, status: 'APPROVED' },
        }),
        app.prisma.resourceRequest.count({ where: { requesterId: userId } }),
        app.prisma.resource.aggregate({
          where: { uploaderId: userId, deletedAt: null },
          _sum: { downloadsCount: true },
        }),
      ]);
      return {
        uploadsCount,
        approvedUploadsCount,
        requestsCount,
        totalDownloads: downloads._sum.downloadsCount ?? 0,
      };
    },
  );

  // Delete own account (soft-delete + anonymize; sessions revoked).
  app.delete(
    '/me',
    { onRequest: app.authenticate, schema: { tags: ['users'], response: { 200: okSchema } } },
    async (req, reply) => {
      const userId = req.authUser!.id;
      const anonEmail = `deleted+${randomUUID()}@studyshare.invalid`;
      await app.prisma.$transaction([
        app.prisma.user.update({
          where: { id: userId },
          data: {
            deletedAt: new Date(),
            status: 'SUSPENDED',
            email: anonEmail,
            name: 'Deleted User',
            passwordHash: null,
            googleId: null,
            avatarUrl: null,
          },
        }),
        app.prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } }),
        app.prisma.resource.updateMany({
          where: { uploaderId: userId },
          data: { deletedAt: new Date() },
        }),
      ]);
      await req.audit(AuditAction.USER_DELETED, { targetType: 'user', targetId: userId });
      reply.clearCookie('ss_refresh', { path: '/api/auth' });
      return reply.send({ ok: true as const });
    },
  );
};
