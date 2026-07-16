import type { PrismaClient } from '@prisma/client';

/** Canonical audit action names (append-only log). */
export const AuditAction = {
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILURE: 'auth.login.failure',
  LOGOUT: 'auth.logout',
  LOGOUT_ALL: 'auth.logout_all',
  SIGNUP: 'auth.signup',
  EMAIL_VERIFIED: 'auth.email_verified',
  PASSWORD_RESET_REQUESTED: 'auth.password_reset.requested',
  PASSWORD_RESET_COMPLETED: 'auth.password_reset.completed',
  PASSWORD_CHANGED: 'auth.password_changed',
  REFRESH_REUSE_DETECTED: 'auth.refresh.reuse_detected',
  OAUTH_LOGIN: 'auth.oauth.login',

  FILE_UPLOAD: 'file.upload',
  FILE_DOWNLOAD: 'file.download',

  RESOURCE_CREATE: 'resource.create',
  RESOURCE_UPDATE: 'resource.update',
  RESOURCE_DELETE: 'resource.delete',
  RESOURCE_APPROVE: 'resource.approve',
  RESOURCE_REJECT: 'resource.reject',

  REQUEST_CREATE: 'request.create',
  REQUEST_FULFILL: 'request.fulfill',

  REPORT_CREATE: 'report.create',
  REPORT_RESOLVE: 'report.resolve',
  COMMENT_HIDE: 'comment.hide',

  USER_ROLE_CHANGED: 'admin.user.role_changed',
  USER_SUSPENDED: 'admin.user.suspended',
  USER_REACTIVATED: 'admin.user.reactivated',
  USER_DELETED: 'user.deleted',
  BRANCH_CREATE: 'admin.branch.create',
  BRANCH_UPDATE: 'admin.branch.update',
  BRANCH_DELETE: 'admin.branch.delete',
  SUBJECT_CREATE: 'admin.subject.create',
  SUBJECT_UPDATE: 'admin.subject.update',
  SUBJECT_DELETE: 'admin.subject.delete',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export interface AuditEntry {
  actorId?: string | null;
  action: AuditAction | string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Write an append-only audit record. Failures are swallowed (never break the
 * business operation) but should surface in logs by the caller if needed.
 */
export async function writeAudit(prisma: PrismaClient, entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      metadata: (entry.metadata ?? undefined) as object | undefined,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}
