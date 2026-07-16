import { describe, expect, it } from 'vitest';
import { Role } from './enums.js';
import { Permission, can, isOwnerOrElevated } from './permissions.js';

describe('permission matrix', () => {
  it('lets any authenticated role create resources', () => {
    expect(can(Role.STUDENT, Permission.RESOURCE_CREATE)).toBe(true);
    expect(can(Role.MODERATOR, Permission.RESOURCE_CREATE)).toBe(true);
    expect(can(Role.ADMIN, Permission.RESOURCE_CREATE)).toBe(true);
  });

  it('restricts moderation to moderators and admins', () => {
    expect(can(Role.STUDENT, Permission.RESOURCE_MODERATE)).toBe(false);
    expect(can(Role.MODERATOR, Permission.RESOURCE_MODERATE)).toBe(true);
    expect(can(Role.ADMIN, Permission.RESOURCE_MODERATE)).toBe(true);
  });

  it('restricts user/branch/audit management to admins only', () => {
    for (const perm of [Permission.USER_MANAGE, Permission.BRANCH_MANAGE, Permission.AUDIT_VIEW]) {
      expect(can(Role.STUDENT, perm)).toBe(false);
      expect(can(Role.MODERATOR, perm)).toBe(false);
      expect(can(Role.ADMIN, perm)).toBe(true);
    }
  });
});

describe('isOwnerOrElevated', () => {
  it('allows the owner regardless of role', () => {
    expect(
      isOwnerOrElevated({ actorId: 'u1', actorRole: Role.STUDENT, ownerId: 'u1' }),
    ).toBe(true);
  });

  it('denies a non-owner student', () => {
    expect(
      isOwnerOrElevated({ actorId: 'u2', actorRole: Role.STUDENT, ownerId: 'u1' }),
    ).toBe(false);
  });

  it('allows a moderator or admin over another user content', () => {
    expect(
      isOwnerOrElevated({ actorId: 'm1', actorRole: Role.MODERATOR, ownerId: 'u1' }),
    ).toBe(true);
    expect(
      isOwnerOrElevated({ actorId: 'a1', actorRole: Role.ADMIN, ownerId: 'u1' }),
    ).toBe(true);
  });
});
