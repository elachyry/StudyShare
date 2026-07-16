import { Role, ROLE_RANK } from './enums.js';

/**
 * The canonical set of authorizable actions in StudyShare.
 *
 * This matrix is the single source of truth: the backend enforces it (the truth)
 * and the frontend consults it to hide/disable UI (UX only). Never rely on the
 * frontend for enforcement.
 *
 * Note: some actions additionally require an *ownership* check (e.g. a student
 * may only edit their own resource). Ownership is enforced server-side in route
 * handlers and is orthogonal to this role gate — see `isOwnerOrElevated`.
 */
export const Permission = {
  // Resources
  RESOURCE_CREATE: 'resource:create',
  RESOURCE_UPDATE_OWN: 'resource:update:own',
  RESOURCE_DELETE_OWN: 'resource:delete:own',
  RESOURCE_MODERATE: 'resource:moderate', // approve / reject
  RESOURCE_DELETE_ANY: 'resource:delete:any',

  // Comments & ratings
  COMMENT_CREATE: 'comment:create',
  COMMENT_DELETE_OWN: 'comment:delete:own',
  COMMENT_HIDE_ANY: 'comment:hide:any',
  RATING_CREATE: 'rating:create',

  // Requests
  REQUEST_CREATE: 'request:create',
  REQUEST_VOTE: 'request:vote',
  REQUEST_FULFILL: 'request:fulfill',

  // Reports / moderation
  REPORT_CREATE: 'report:create',
  REPORT_RESOLVE: 'report:resolve',

  // Admin
  USER_MANAGE: 'user:manage', // suspend, change role
  BRANCH_MANAGE: 'branch:manage', // branches & subjects CRUD
  AUDIT_VIEW: 'audit:view',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

/** Which roles are granted each permission. */
export const PERMISSION_MATRIX: Record<Permission, Role[]> = {
  [Permission.RESOURCE_CREATE]: [Role.STUDENT, Role.MODERATOR, Role.ADMIN],
  [Permission.RESOURCE_UPDATE_OWN]: [Role.STUDENT, Role.MODERATOR, Role.ADMIN],
  [Permission.RESOURCE_DELETE_OWN]: [Role.STUDENT, Role.MODERATOR, Role.ADMIN],
  [Permission.RESOURCE_MODERATE]: [Role.MODERATOR, Role.ADMIN],
  [Permission.RESOURCE_DELETE_ANY]: [Role.MODERATOR, Role.ADMIN],

  [Permission.COMMENT_CREATE]: [Role.STUDENT, Role.MODERATOR, Role.ADMIN],
  [Permission.COMMENT_DELETE_OWN]: [Role.STUDENT, Role.MODERATOR, Role.ADMIN],
  [Permission.COMMENT_HIDE_ANY]: [Role.MODERATOR, Role.ADMIN],
  [Permission.RATING_CREATE]: [Role.STUDENT, Role.MODERATOR, Role.ADMIN],

  [Permission.REQUEST_CREATE]: [Role.STUDENT, Role.MODERATOR, Role.ADMIN],
  [Permission.REQUEST_VOTE]: [Role.STUDENT, Role.MODERATOR, Role.ADMIN],
  [Permission.REQUEST_FULFILL]: [Role.STUDENT, Role.MODERATOR, Role.ADMIN],

  [Permission.REPORT_CREATE]: [Role.STUDENT, Role.MODERATOR, Role.ADMIN],
  [Permission.REPORT_RESOLVE]: [Role.MODERATOR, Role.ADMIN],

  [Permission.USER_MANAGE]: [Role.ADMIN],
  [Permission.BRANCH_MANAGE]: [Role.ADMIN],
  [Permission.AUDIT_VIEW]: [Role.ADMIN],
};

/** True if `role` is granted `permission` by the matrix. */
export function can(role: Role, permission: Permission): boolean {
  return PERMISSION_MATRIX[permission].includes(role);
}

/**
 * Ownership helper for "own"-scoped actions: the actor may act when they own the
 * target OR when they are elevated (moderator/admin outrank a student owner).
 */
export function isOwnerOrElevated(params: {
  actorId: string;
  actorRole: Role;
  ownerId: string;
  minElevatedRole?: Role;
}): boolean {
  const { actorId, actorRole, ownerId, minElevatedRole = Role.MODERATOR } = params;
  if (actorId === ownerId) return true;
  return ROLE_RANK[actorRole] >= ROLE_RANK[minElevatedRole];
}
