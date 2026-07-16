import { describe, expect, it } from 'vitest';
import { generateOpaqueToken, hashToken, sha256Hex } from '../src/modules/auth/tokens.js';
import { hashPassword, verifyPassword, assertStrongPassword } from '../src/modules/auth/auth.service.js';
import { AppError } from '../src/lib/errors.js';

describe('opaque tokens', () => {
  it('generates unique, url-safe tokens', () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('hashes tokens deterministically (sha256 hex)', () => {
    const token = 'some-secret-token';
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).toHaveLength(64);
    expect(hashToken('a')).not.toBe(hashToken('b'));
  });

  it('computes a stable sha256 of file bytes', () => {
    const buf = Buffer.from('hello world');
    expect(sha256Hex(buf)).toBe(
      'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
    );
  });
});

describe('password hashing (argon2id)', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('V3ry!Str0ng-Passw0rd');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, 'V3ry!Str0ng-Passw0rd')).toBe(true);
    expect(await verifyPassword(hash, 'wrong-password')).toBe(false);
  });

  it('never returns a false positive on a malformed hash', async () => {
    expect(await verifyPassword('not-a-hash', 'anything')).toBe(false);
  });
});

describe('password strength gate', () => {
  it('rejects weak passwords and accepts strong ones', () => {
    expect(() => assertStrongPassword('password123')).toThrow(AppError);
    expect(() => assertStrongPassword('Tr0ub4dour&3xplan')).not.toThrow();
  });
});
