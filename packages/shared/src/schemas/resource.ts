import { z } from 'zod';
import { resourceStatusSchema, resourceTypeSchema } from '../enums.js';
import { paginationQuerySchema } from './common.js';

/** Public uploader summary embedded in resource responses. */
export const userSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
});
export type UserSummary = z.infer<typeof userSummarySchema>;

export const resourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  type: resourceTypeSchema,
  status: resourceStatusSchema,
  branchId: z.string(),
  subjectId: z.string(),
  uploaderId: z.string(),
  uploader: userSummarySchema,
  fileId: z.string(),
  fileName: z.string(),
  fileSizeBytes: z.number(),
  mimeType: z.string(),
  downloadsCount: z.number(),
  averageRating: z.number(),
  ratingsCount: z.number(),
  createdAt: z.string(),
});
export type Resource = z.infer<typeof resourceSchema>;

/**
 * Create-resource metadata. The file itself is uploaded separately (multipart)
 * and referenced by `fileId`, so this stays a plain JSON body that both sides
 * validate identically.
 */
export const createResourceSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().max(2000).optional(),
    type: resourceTypeSchema,
    branchId: z.string().min(1),
    subjectId: z.string().min(1),
    fileId: z.string().min(1),
  })
  .strict();
export type CreateResourceInput = z.infer<typeof createResourceSchema>;

export const updateResourceSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().max(2000).optional(),
    type: resourceTypeSchema.optional(),
    subjectId: z.string().min(1).optional(),
  })
  .strict();
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;

export const moderateResourceSchema = z
  .object({
    decision: z.enum(['APPROVE', 'REJECT']),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();
export type ModerateResourceInput = z.infer<typeof moderateResourceSchema>;

export const resourceSortSchema = z
  .enum(['newest', 'downloads', 'rating'])
  .default('newest');

export const listResourcesQuerySchema = paginationQuerySchema.extend({
  branchId: z.string().optional(),
  subjectId: z.string().optional(),
  type: resourceTypeSchema.optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  q: z.string().trim().max(160).optional(),
  sort: resourceSortSchema,
  status: resourceStatusSchema.optional(), // moderators/admins only
});
export type ListResourcesQuery = z.infer<typeof listResourcesQuerySchema>;

/** Response of a download-URL request. */
export const downloadUrlSchema = z.object({
  url: z.string(),
  expiresInSeconds: z.number(),
});
export type DownloadUrl = z.infer<typeof downloadUrlSchema>;

/** File upload result returned by the multipart upload endpoint. */
export const uploadedFileSchema = z.object({
  fileId: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  checksum: z.string(),
});
export type UploadedFile = z.infer<typeof uploadedFileSchema>;
