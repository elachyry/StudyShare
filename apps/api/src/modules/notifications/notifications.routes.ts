import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  notificationSchema,
  listNotificationsQuerySchema,
  paginated,
  okSchema,
} from '@studyshare/shared';
import { Errors } from '../../lib/errors.js';

function serialize(n: {
  id: string;
  type: string;
  payload: unknown;
  readAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: n.id,
    type: n.type as never,
    payload: (n.payload ?? {}) as Record<string, unknown>,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  };
}

export const notificationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['notifications'],
        querystring: listNotificationsQuerySchema,
        response: { 200: paginated(notificationSchema) },
      },
    },
    async (req) => {
      const where = {
        userId: req.authUser!.id,
        ...(req.query.unreadOnly ? { readAt: null } : {}),
      };
      const rows = await app.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: req.query.limit + 1,
        ...(req.query.cursor ? { cursor: { id: req.query.cursor }, skip: 1 } : {}),
      });
      const items = rows.slice(0, req.query.limit);
      const nextCursor =
        rows.length > req.query.limit ? (items[items.length - 1]?.id ?? null) : null;
      return { items: items.map(serialize), nextCursor };
    },
  );

  app.get(
    '/unread-count',
    {
      onRequest: app.authenticate,
      schema: { tags: ['notifications'], response: { 200: z.object({ count: z.number() }) } },
    },
    async (req) => {
      const count = await app.prisma.notification.count({
        where: { userId: req.authUser!.id, readAt: null },
      });
      return { count };
    },
  );

  app.post(
    '/:id/read',
    {
      onRequest: app.authenticate,
      schema: {
        tags: ['notifications'],
        params: z.object({ id: z.string() }),
        response: { 200: okSchema },
      },
    },
    async (req) => {
      const result = await app.prisma.notification.updateMany({
        where: { id: req.params.id, userId: req.authUser!.id },
        data: { readAt: new Date() },
      });
      if (result.count === 0) throw Errors.notFound();
      return { ok: true as const };
    },
  );

  app.post(
    '/read-all',
    {
      onRequest: app.authenticate,
      schema: { tags: ['notifications'], response: { 200: okSchema } },
    },
    async (req) => {
      await app.prisma.notification.updateMany({
        where: { userId: req.authUser!.id, readAt: null },
        data: { readAt: new Date() },
      });
      return { ok: true as const };
    },
  );
};
