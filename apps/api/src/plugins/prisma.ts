import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

/**
 * Attaches a single PrismaClient to the Fastify instance and closes it on
 * shutdown. Prisma uses parameterized queries throughout — no raw string SQL.
 */
export default fp(
  async (app) => {
    const prisma = new PrismaClient({
      log: app.log.level === 'debug' ? ['warn', 'error'] : ['error'],
    });
    await prisma.$connect();
    app.decorate('prisma', prisma);
    app.addHook('onClose', async () => {
      await prisma.$disconnect();
    });
  },
  { name: 'prisma' },
);
