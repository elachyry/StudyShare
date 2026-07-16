import type { FastifyInstance } from 'fastify';

/**
 * Upsert a user's rating (one per user per resource) and refresh the
 * denormalized aggregates on the resource in a single transaction.
 */
export async function rateResource(
  app: FastifyInstance,
  resourceId: string,
  userId: string,
  value: number,
): Promise<{ avgRating: number; ratingsCount: number }> {
  return app.prisma.$transaction(async (tx) => {
    await tx.rating.upsert({
      where: { resourceId_userId: { resourceId, userId } },
      create: { resourceId, userId, value },
      update: { value },
    });
    const agg = await tx.rating.aggregate({
      where: { resourceId },
      _avg: { value: true },
      _count: true,
    });
    const avgRating = agg._avg.value ?? 0;
    const ratingsCount = agg._count;
    await tx.resource.update({
      where: { id: resourceId },
      data: { avgRating, ratingsCount },
    });
    return { avgRating, ratingsCount };
  });
}
