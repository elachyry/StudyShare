import { z } from 'zod';
import {
  notificationTypeValues,
  reportStatusSchema,
  reportTargetTypeSchema,
} from '../enums.js';
import { userSummarySchema } from './resource.js';
import { paginationQuerySchema } from './common.js';

// ---- Ratings ----
export const ratingSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  userId: z.string(),
  value: z.number().int().min(1).max(5),
  createdAt: z.string(),
});

export const createRatingSchema = z
  .object({ value: z.number().int().min(1).max(5) })
  .strict();
export type CreateRatingInput = z.infer<typeof createRatingSchema>;

// ---- Comments ----
export const commentSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  userId: z.string(),
  author: userSummarySchema,
  body: z.string(),
  deletedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Comment = z.infer<typeof commentSchema>;

export const createCommentSchema = z
  .object({ body: z.string().trim().min(1).max(2000) })
  .strict();
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

// ---- Reports ----
export const createReportSchema = z
  .object({
    targetType: reportTargetTypeSchema,
    targetId: z.string().min(1),
    reason: z.string().trim().min(3).max(1000),
  })
  .strict();
export type CreateReportInput = z.infer<typeof createReportSchema>;

export const reportSchema = z.object({
  id: z.string(),
  targetType: reportTargetTypeSchema,
  targetId: z.string(),
  reporterId: z.string(),
  reason: z.string(),
  status: reportStatusSchema,
  createdAt: z.string(),
});
export type Report = z.infer<typeof reportSchema>;

export const resolveReportSchema = z
  .object({ status: z.enum(['RESOLVED', 'DISMISSED']) })
  .strict();

// ---- Notifications ----
export const notificationSchema = z.object({
  id: z.string(),
  type: z.enum(notificationTypeValues),
  payload: z.record(z.unknown()),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Notification = z.infer<typeof notificationSchema>;

export const listNotificationsQuerySchema = paginationQuerySchema.extend({
  unreadOnly: z.coerce.boolean().optional(),
});
