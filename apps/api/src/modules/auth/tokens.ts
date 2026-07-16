import { createHash, randomBytes } from 'node:crypto';

/**
 * Opaque token helpers. Refresh tokens and email tokens are random secrets sent
 * to the client but stored ONLY as SHA-256 hashes in the DB, so a database leak
 * never exposes usable tokens. Lookups hash the presented token and compare.
 */
export function generateOpaqueToken(bytes = 48): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}
