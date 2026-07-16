import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { checkStorageReady } from '../../lib/storage.js';

/**
 * Liveness (`/health`) and readiness (`/ready`) probes. Readiness verifies DB
 * and object-storage connectivity so orchestrators only route traffic when
 * dependencies are reachable.
 */
export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['system'],
        response: { 200: z.object({ status: z.literal('ok') }) },
      },
    },
    async () => ({ status: 'ok' as const }),
  );

  app.get(
    '/ready',
    {
      schema: {
        tags: ['system'],
        response: {
          200: z.object({
            status: z.literal('ready'),
            checks: z.object({ database: z.boolean(), storage: z.boolean() }),
          }),
          503: z.object({
            status: z.literal('not_ready'),
            checks: z.object({ database: z.boolean(), storage: z.boolean() }),
          }),
        },
      },
    },
    async (_req, reply) => {
      const [database, storage] = await Promise.all([
        app.prisma
          .$queryRaw`SELECT 1`.then(() => true)
          .catch(() => false),
        checkStorageReady(),
      ]);
      const ready = database && storage;
      return reply.code(ready ? 200 : 503).send({
        status: ready ? ('ready' as const) : ('not_ready' as const),
        checks: { database, storage },
      });
    },
  );
};
