import type { FastifyBaseLogger } from 'fastify';

/**
 * Pluggable virus-scan hook (ClamAV-ready). The default implementation is a
 * no-op that marks content as "scanned=clean" so the moderation pipeline can
 * proceed in dev. To enable real scanning, replace the body with a call to a
 * ClamAV daemon (e.g. via `clamscan`/`clamd`) and return `false` on detection.
 *
 * Resources stay PENDING until scanned AND moderator-approved (see resources
 * module), so wiring a real scanner requires no other code changes.
 */
export async function scanFile(
  _buffer: Buffer,
  _logger?: FastifyBaseLogger,
): Promise<{ clean: boolean }> {
  // Integration point: connect to ClamAV here.
  return { clean: true };
}
