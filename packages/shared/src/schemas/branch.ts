import { z } from 'zod';
import { slugSchema } from './common.js';

export const branchSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameFr: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
});
export type Branch = z.infer<typeof branchSchema>;

export const subjectSchema = z.object({
  id: z.string(),
  branchId: z.string(),
  name: z.string(),
  nameFr: z.string(),
  slug: z.string(),
});
export type Subject = z.infer<typeof subjectSchema>;

export const createBranchSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    nameFr: z.string().trim().min(2).max(80),
    slug: slugSchema,
    description: z.string().trim().max(500).optional(),
  })
  .strict();
export type CreateBranchInput = z.infer<typeof createBranchSchema>;

export const updateBranchSchema = createBranchSchema.partial();

export const createSubjectSchema = z
  .object({
    branchId: z.string().min(1),
    name: z.string().trim().min(2).max(80),
    nameFr: z.string().trim().min(2).max(80),
    slug: slugSchema,
  })
  .strict();
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;

export const updateSubjectSchema = createSubjectSchema.partial();
