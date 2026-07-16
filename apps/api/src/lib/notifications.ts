import type { PrismaClient, Prisma } from '@prisma/client';
import type { NotificationType } from '@studyshare/shared';

/**
 * Create an in-app notification. Email fan-out (optional) is handled by the
 * caller where an Accept-Language is available; this focuses on the durable
 * in-app bell feed.
 */
export async function notify(
  prisma: PrismaClient,
  params: {
    userId: string;
    type: NotificationType;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      payload: params.payload as Prisma.InputJsonValue,
    },
  });
}
