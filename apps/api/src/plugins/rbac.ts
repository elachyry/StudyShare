import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import type { Permission, Role } from '@studyshare/shared';
import { can, isOwnerOrElevated, Role as Roles, ROLE_RANK } from '@studyshare/shared';
import { Errors } from '../lib/errors.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** preHandler: require the authenticated user to hold a permission. */
    authorize: (permission: Permission) => preHandlerHookHandler;
    /** preHandler: require at least the given role. */
    requireRole: (min: Role) => preHandlerHookHandler;
  }
}

/**
 * RBAC enforcement built on the shared permission matrix — the single source of
 * truth the frontend also consults. The frontend only hides UI; the backend is
 * the authority. Ownership checks (IDOR prevention) live in handlers via the
 * exported `assertOwnership` helper.
 */
export default fp(
  async (app) => {
    app.decorate('authorize', (permission: Permission): preHandlerHookHandler => {
      return async (req: FastifyRequest, reply: FastifyReply) => {
        await app.authenticate(req, reply);
        if (!req.authUser || !can(req.authUser.role, permission)) {
          throw Errors.forbidden();
        }
      };
    });

    app.decorate('requireRole', (min: Role): preHandlerHookHandler => {
      return async (req: FastifyRequest, reply: FastifyReply) => {
        await app.authenticate(req, reply);
        if (!req.authUser || ROLE_RANK[req.authUser.role] < ROLE_RANK[min]) {
          throw Errors.forbidden();
        }
      };
    });
  },
  { name: 'rbac', dependencies: ['auth'] },
);

/**
 * Ownership guard for "own"-scoped mutations. Throws 403 unless the actor owns
 * the target or is elevated (moderator/admin). Prevents IDOR.
 */
export function assertOwnership(params: {
  actor: { id: string; role: Role };
  ownerId: string;
  minElevatedRole?: Role;
}): void {
  const ok = isOwnerOrElevated({
    actorId: params.actor.id,
    actorRole: params.actor.role,
    ownerId: params.ownerId,
    minElevatedRole: params.minElevatedRole ?? Roles.MODERATOR,
  });
  if (!ok) throw Errors.forbidden();
}
