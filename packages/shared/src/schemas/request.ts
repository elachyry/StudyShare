import { z } from 'zod';
import { requestStatusSchema, resourceTypeSchema } from '../enums.js';
import { paginationQuerySchema } from './common.js';
import { userSummarySchema } from './resource.js';

export const resourceRequestSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  type: resourceTypeSchema,
  branchId: z.string(),
  subjectId: z.string(),
  requesterId: z.string(),
  requester: userSummarySchema,
  status: requestStatusSchema,
  fulfilledByResourceId: z.string().nullable(),
  votesCount: z.number(),
  viewerHasVoted: z.boolean(),
  createdAt: z.string(),
});
export type ResourceRequest = z.infer<typeof resourceRequestSchema>;

export const createRequestSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().max(2000).optional(),
    type: resourceTypeSchema,
    branchId: z.string().min(1),
    subjectId: z.string().min(1),
  })
  .strict();
export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const fulfillRequestSchema = z
  .object({ resourceId: z.string().min(1) })
  .strict();
export type FulfillRequestInput = z.infer<typeof fulfillRequestSchema>;

export const listRequestsQuerySchema = paginationQuerySchema.extend({
  branchId: z.string().optional(),
  subjectId: z.string().optional(),
  type: resourceTypeSchema.optional(),
  status: requestStatusSchema.optional(),
  sort: z.enum(['votes', 'newest']).default('votes'),
});
export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>;
