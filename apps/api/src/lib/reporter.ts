import type { FastifyBaseLogger } from 'fastify';
import { env } from '../config/env.js';

/**
 * Pluggable error reporter (Sentry-ready). A single wrapper so a DSN can be
 * added via env without touching call sites. When SENTRY_DSN is unset this is a
 * no-op beyond logging; when a real reporter is wired, forward here.
 */
export function captureException(
  error: unknown,
  logger: FastifyBaseLogger,
  context?: Record<string, unknown>,
): void {
  logger.error({ err: error, ...context }, 'unhandled_exception');
  if (!env.SENTRY_DSN) return;
  // Integration point: initialize + forward to Sentry (or similar) here.
  // e.g. Sentry.captureException(error, { extra: context });
}
