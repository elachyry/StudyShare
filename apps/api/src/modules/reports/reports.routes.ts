import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  Permission,
  createReportSchema,
  reportSchema,
  resolveReportSchema,
  listAuditLogsQuerySchema,
  paginated,
} from '@studyshare/shared';
import { AuditAction } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';

function serializeReport(r: {
  id: string;
  targetType: 'RESOURCE' | 'COMMENT';
  targetId: string;
  reporterId: string;
  reason: string;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  createdAt: Date;
}) {
  return {
    id: r.id,
    targetType: r.targetType,
    targetId: r.targetId,
    reporterId: r.reporterId,
    reason: r.reason,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  };
}

export const reportRoutes: FastifyPluginAsyncZod = async (app) => {
  // Create a report (any authenticated user).
  app.post(
    '/',
    {
      onRequest: app.authenticate,
      preHandler: app.authorize(Permission.REPORT_CREATE),
      schema: { tags: ['reports'], body: createReportSchema, response: { 201: reportSchema } },
    },
    async (req, reply) => {
      const report = await app.prisma.report.create({
        data: {
          targetType: req.body.targetType,
          targetId: req.body.targetId,
          reporterId: req.authUser!.id,
          reason: req.body.reason,
        },
      });
      await req.audit(AuditAction.REPORT_CREATE, {
        targetType: req.body.targetType,
        targetId: req.body.targetId,
        metadata: { reportId: report.id },
      });
      return reply.code(201).send(serializeReport(report));
    },
  );

  // Moderation queue: list reports (moderators/admins).
  app.get(
    '/',
    {
      preHandler: app.authorize(Permission.REPORT_RESOLVE),
      schema: {
        tags: ['reports'],
        querystring: listAuditLogsQuerySchema.pick({ cursor: true, limit: true }).extend({
          status: z.enum(['OPEN', 'RESOLVED', 'DISMISSED']).optional(),
        }),
        response: { 200: paginated(reportSchema) },
      },
    },
    async (req) => {
      const limit = req.query.limit;
      const rows = await app.prisma.report.findMany({
        where: req.query.status ? { status: req.query.status } : {},
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(req.query.cursor ? { cursor: { id: req.query.cursor }, skip: 1 } : {}),
      });
      const items = rows.slice(0, limit);
      const nextCursor = rows.length > limit ? (items[items.length - 1]?.id ?? null) : null;
      return { items: items.map(serializeReport), nextCursor };
    },
  );

  // Resolve / dismiss a report (moderators/admins).
  app.post(
    '/:id/resolve',
    {
      preHandler: app.authorize(Permission.REPORT_RESOLVE),
      schema: {
        tags: ['reports'],
        params: z.object({ id: z.string() }),
        body: resolveReportSchema,
        response: { 200: reportSchema },
      },
    },
    async (req) => {
      const existing = await app.prisma.report.findUnique({ where: { id: req.params.id } });
      if (!existing) throw Errors.notFound();
      const report = await app.prisma.report.update({
        where: { id: existing.id },
        data: { status: req.body.status },
      });
      await req.audit(AuditAction.REPORT_RESOLVE, {
        targetType: 'report',
        targetId: report.id,
        metadata: { status: req.body.status },
      });
      return serializeReport(report);
    },
  );
};
