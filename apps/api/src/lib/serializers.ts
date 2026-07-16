import type {
  Resource,
  FileObject,
  User,
  ResourceRequest,
  Comment,
  Branch,
  Subject,
} from '@prisma/client';
import type {
  Resource as ResourceDTO,
  ResourceRequest as RequestDTO,
  Comment as CommentDTO,
  Branch as BranchDTO,
  Subject as SubjectDTO,
  UserSummary,
} from '@studyshare/shared';

/**
 * Map Prisma rows to the shared response DTOs. Centralized so the API response
 * shape always matches the shared Zod schemas (contract stays in sync FE/BE).
 */

export function userSummary(u: Pick<User, 'id' | 'name' | 'avatarUrl'>): UserSummary {
  return { id: u.id, name: u.name, avatarUrl: u.avatarUrl };
}

export function serializeResource(
  r: Resource & { uploader: User; file: FileObject },
): ResourceDTO {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    type: r.type,
    status: r.status,
    branchId: r.branchId,
    subjectId: r.subjectId,
    uploaderId: r.uploaderId,
    uploader: userSummary(r.uploader),
    fileId: r.fileId,
    fileName: r.file.originalName,
    fileSizeBytes: r.file.sizeBytes,
    mimeType: r.file.mimeType,
    downloadsCount: r.downloadsCount,
    averageRating: r.avgRating,
    ratingsCount: r.ratingsCount,
    createdAt: r.createdAt.toISOString(),
  };
}

export function serializeRequest(
  r: ResourceRequest & { requester: User },
  viewerHasVoted: boolean,
): RequestDTO {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    type: r.type,
    branchId: r.branchId,
    subjectId: r.subjectId,
    requesterId: r.requesterId,
    requester: userSummary(r.requester),
    status: r.status,
    fulfilledByResourceId: r.fulfilledByResourceId,
    votesCount: r.votesCount,
    viewerHasVoted,
    createdAt: r.createdAt.toISOString(),
  };
}

export function serializeComment(c: Comment & { user: User }): CommentDTO {
  return {
    id: c.id,
    resourceId: c.resourceId,
    userId: c.userId,
    author: userSummary(c.user),
    // Hidden/deleted comments have their body redacted in the response.
    body: c.deletedAt ? '' : c.body,
    deletedAt: c.deletedAt ? c.deletedAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  };
}

export function serializeBranch(b: Branch): BranchDTO {
  return {
    id: b.id,
    name: b.name,
    nameFr: b.nameFr,
    slug: b.slug,
    description: b.description,
    createdAt: b.createdAt.toISOString(),
  };
}

export function serializeSubject(s: Subject): SubjectDTO {
  return { id: s.id, branchId: s.branchId, name: s.name, nameFr: s.nameFr, slug: s.slug };
}
