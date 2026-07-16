import fp from 'fastify-plugin';
import type { FastifyRequest } from 'fastify';
import { writeAudit, type AuditAction, type AuditEntry } from '../lib/audit.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Record an audit entry, auto-capturing actor, ip and user-agent. */
    audit: (
      action: AuditAction | string,
      extra?: Partial<Pick<AuditEntry, 'targetType' | 'targetId' | 'metadata' | 'actorId'>>,
    ) => Promise<void>;
  }
}

/**
 * Decorates `req.audit(...)` for explicit, request-aware audit logging from
 * handlers. Actor, IP and user-agent are captured automatically. Write failures
 * are logged but never propagate (auditing must not break the operation).
 */
export default fp(
  async (app) => {
    app.decorateRequest('audit', function (this: FastifyRequest, action, extra) {
      const entry: AuditEntry = {
        actorId: extra?.actorId ?? this.authUser?.id ?? null,
        action,
        targetType: extra?.targetType ?? null,
        targetId: extra?.targetId ?? null,
        metadata: extra?.metadata ?? null,
        ip: this.ip,
        userAgent: this.headers['user-agent'] ?? null,
      };
      const log = this.log;
      return writeAudit(app.prisma, entry).catch((err) => {
        log.error({ err, action }, 'failed to write audit log');
      });
    });
  },
  { name: 'audit', dependencies: ['prisma'] },
);
