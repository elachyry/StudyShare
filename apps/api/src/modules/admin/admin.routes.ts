import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import {
  Permission,
  adminUserSchema,
  listUsersQuerySchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
  auditLogSchema,
  listAuditLogsQuerySchema,
  paginated,
} from '@studyshare/shared';
import { AuditAction } from '../../lib/audit.js';
import { AppError, Errors } from '../../lib/errors.js';
import { ErrorCode } from '@studyshare/shared';

function serializeUser(u: {
  id: string;
  email: string;
  name: string;
  role: 'STUDENT' | 'MODERATOR' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED';
  emailVerified: boolean;
  branchId: string | null;
  createdAt: Date;
  deletedAt: Date | null;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    emailVerified: u.emailVerified,
    branchId: u.branchId,
    createdAt: u.createdAt.toISOString(),
    deletedAt: u.deletedAt ? u.deletedAt.toISOString() : null,
  };
}

/** Admin-only endpoints: user management + read-only audit log with CSV export. */
export const adminRoutes: FastifyPluginAsyncZod = async (app) => {
  // ---- User management ----
  app.get(
    '/users',
    {
      preHandler: app.authorize(Permission.USER_MANAGE),
      schema: {
        tags: ['admin'],
        querystring: listUsersQuerySchema,
        response: { 200: paginated(adminUserSchema) },
      },
    },
    async (req) => {
      const where: Prisma.UserWhereInput = {
        ...(req.query.role ? { role: req.query.role } : {}),
        ...(req.query.status ? { status: req.query.status } : {}),
        ...(req.query.q
          ? {
              OR: [
                { email: { contains: req.query.q, mode: 'insensitive' } },
                { name: { contains: req.query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      };
      const rows = await app.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: req.query.limit + 1,
        ...(req.query.cursor ? { cursor: { id: req.query.cursor }, skip: 1 } : {}),
      });
      const items = rows.slice(0, req.query.limit);
      const nextCursor =
        rows.length > req.query.limit ? (items[items.length - 1]?.id ?? null) : null;
      return { items: items.map(serializeUser), nextCursor };
    },
  );

  app.patch(
    '/users/:id/role',
    {
      preHandler: app.authorize(Permission.USER_MANAGE),
      schema: {
        tags: ['admin'],
        params: z.object({ id: z.string() }),
        body: updateUserRoleSchema,
        response: { 200: adminUserSchema },
      },
    },
    async (req) => {
      if (req.params.id === req.authUser!.id) {
        // Prevent an admin from accidentally de-privileging themselves.
        throw new AppError({ statusCode: 409, code: ErrorCode.CONFLICT });
      }
      const user = await app.prisma.user
        .update({ where: { id: req.params.id }, data: { role: req.body.role } })
        .catch(() => {
          throw Errors.notFound();
        });
      await req.audit(AuditAction.USER_ROLE_CHANGED, {
        targetType: 'user',
        targetId: user.id,
        metadata: { role: req.body.role },
      });
      return serializeUser(user);
    },
  );

  app.patch(
    '/users/:id/status',
    {
      preHandler: app.authorize(Permission.USER_MANAGE),
      schema: {
        tags: ['admin'],
        params: z.object({ id: z.string() }),
        body: updateUserStatusSchema,
        response: { 200: adminUserSchema },
      },
    },
    async (req) => {
      if (req.params.id === req.authUser!.id) {
        throw new AppError({ statusCode: 409, code: ErrorCode.CONFLICT });
      }
      const user = await app.prisma.user
        .update({ where: { id: req.params.id }, data: { status: req.body.status } })
        .catch(() => {
          throw Errors.notFound();
        });
      // Suspending revokes all sessions immediately.
      if (req.body.status === 'SUSPENDED') {
        await app.prisma.refreshToken.updateMany({
          where: { userId: user.id },
          data: { revoked: true },
        });
      }
      await req.audit(
        req.body.status === 'SUSPENDED'
          ? AuditAction.USER_SUSPENDED
          : AuditAction.USER_REACTIVATED,
        { targetType: 'user', targetId: user.id },
      );
      return serializeUser(user);
    },
  );

  // ---- Audit log (read-only, searchable, paginated, CSV export) ----
  function auditWhere(q: z.infer<typeof listAuditLogsQuerySchema>): Prisma.AuditLogWhereInput {
    return {
      ...(q.action ? { action: q.action } : {}),
      ...(q.actorId ? { actorId: q.actorId } : {}),
      ...(q.targetType ? { targetType: q.targetType } : {}),
      ...(q.from || q.to
        ? {
            createdAt: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(q.to) } : {}),
            },
          }
        : {}),
    };
  }

  app.get(
    '/audit-logs',
    {
      preHandler: app.authorize(Permission.AUDIT_VIEW),
      schema: {
        tags: ['admin'],
        querystring: listAuditLogsQuerySchema,
        response: { 200: paginated(auditLogSchema) },
      },
    },
    async (req) => {
      const rows = await app.prisma.auditLog.findMany({
        where: auditWhere(req.query),
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { email: true } } },
        take: req.query.limit + 1,
        ...(req.query.cursor ? { cursor: { id: req.query.cursor }, skip: 1 } : {}),
      });
      const items = rows.slice(0, req.query.limit);
      const nextCursor =
        rows.length > req.query.limit ? (items[items.length - 1]?.id ?? null) : null;
      return {
        items: items.map((l) => ({
          id: l.id,
          actorId: l.actorId,
          actorEmail: l.actor?.email ?? null,
          action: l.action,
          targetType: l.targetType,
          targetId: l.targetId,
          metadata: (l.metadata ?? null) as Record<string, unknown> | null,
          ip: l.ip,
          userAgent: l.userAgent,
          createdAt: l.createdAt.toISOString(),
        })),
        nextCursor,
      };
    },
  );

  app.get(
    '/audit-logs/export',
    {
      preHandler: app.authorize(Permission.AUDIT_VIEW),
      schema: {
        tags: ['admin'],
        querystring: listAuditLogsQuerySchema.omit({ cursor: true, limit: true }),
      },
    },
    async (req, reply) => {
      const rows = await app.prisma.auditLog.findMany({
        where: auditWhere({ ...req.query, limit: 20 }),
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { email: true } } },
        take: 10000, // export cap
      });
      const header = 'createdAt,action,actorEmail,targetType,targetId,ip\n';
      const csv =
        header +
        rows
          .map((l) =>
            [
              l.createdAt.toISOString(),
              l.action,
              l.actor?.email ?? '',
              l.targetType ?? '',
              l.targetId ?? '',
              l.ip ?? '',
            ]
              .map((v) => `"${String(v).replace(/"/g, '""')}"`)
              .join(','),
          )
          .join('\n');
      reply.header('content-type', 'text/csv; charset=utf-8');
      reply.header('content-disposition', 'attachment; filename="audit-logs.csv"');
      return reply.send(csv);
    },
  );
};
