import { z } from 'zod';
import { roleSchema, userStatusSchema } from '../enums.js';
import { paginationQuerySchema } from './common.js';

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    branchId: z.string().min(1).nullable().optional(),
  })
  .strict();
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const profileStatsSchema = z.object({
  uploadsCount: z.number(),
  approvedUploadsCount: z.number(),
  requestsCount: z.number(),
  totalDownloads: z.number(),
});
export type ProfileStats = z.infer<typeof profileStatsSchema>;

// ---- Admin: user management ----
export const adminUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: roleSchema,
  status: userStatusSchema,
  emailVerified: z.boolean(),
  branchId: z.string().nullable(),
  createdAt: z.string(),
  deletedAt: z.string().nullable(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const listUsersQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(160).optional(),
  role: roleSchema.optional(),
  status: userStatusSchema.optional(),
});

export const updateUserRoleSchema = z.object({ role: roleSchema }).strict();
export const updateUserStatusSchema = z.object({ status: userStatusSchema }).strict();
