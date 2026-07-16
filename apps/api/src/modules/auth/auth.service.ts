import argon2 from 'argon2';
import zxcvbn from 'zxcvbn';
import type { PrismaClient, User } from '@prisma/client';
import { ErrorCode } from '@studyshare/shared';
import { AppError, Errors } from '../../lib/errors.js';
import { sendMail, emailTemplates } from '../../lib/mailer.js';
import { writeAudit, AuditAction } from '../../lib/audit.js';
import { env } from '../../config/env.js';
import { generateOpaqueToken, hashToken } from './tokens.js';

const ARGON2_OPTS: argon2.Options = { type: argon2.argon2id };
const MIN_PASSWORD_SCORE = 3; // zxcvbn 0..4

export interface RequestCtx {
  ip?: string | null;
  userAgent?: string | null;
  lang: 'en' | 'fr';
}

/** Verify a password meets the zxcvbn strength bar (beyond the structural regex). */
export function assertStrongPassword(password: string, userInputs: string[] = []): void {
  const { score } = zxcvbn(password, userInputs);
  if (score < MIN_PASSWORD_SCORE) {
    throw new AppError({ statusCode: 400, code: ErrorCode.AUTH_PASSWORD_TOO_WEAK });
  }
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Sign up. Creates an unverified user and emails a verification link. To avoid
 * user enumeration we still return success shape even if the email is taken —
 * but we throw AUTH_EMAIL_TAKEN only after constant-time-ish handling. Here we
 * choose to surface a generic conflict without confirming existence via timing:
 * we always hash the password first.
 */
export async function signup(
  prisma: PrismaClient,
  input: { email: string; password: string; name: string },
  ctx: RequestCtx,
): Promise<void> {
  assertStrongPassword(input.password, [input.email, input.name]);
  const passwordHash = await hashPassword(input.password);

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    // Do not reveal existence via a distinct error path in the happy UI flow;
    // the route maps this to a generic message. We still audit the attempt.
    await writeAudit(prisma, {
      action: AuditAction.SIGNUP,
      targetType: 'user',
      metadata: { outcome: 'email_taken' },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    throw Errors.conflict(ErrorCode.AUTH_EMAIL_TAKEN);
  }

  const user = await prisma.user.create({
    data: { email: input.email, name: input.name, passwordHash },
  });

  await issueEmailToken(prisma, user.id, 'VERIFY_EMAIL', ctx.lang);

  await writeAudit(prisma, {
    actorId: user.id,
    action: AuditAction.SIGNUP,
    targetType: 'user',
    targetId: user.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}

/** Create and email a VERIFY_EMAIL or RESET_PASSWORD token (stored hashed). */
export async function issueEmailToken(
  prisma: PrismaClient,
  userId: string,
  type: 'VERIFY_EMAIL' | 'RESET_PASSWORD',
  lang: 'en' | 'fr',
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const token = generateOpaqueToken();
  const ttlMs = type === 'VERIFY_EMAIL' ? 24 * 60 * 60 * 1000 : 30 * 60 * 1000;
  await prisma.emailToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      type,
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });

  if (type === 'VERIFY_EMAIL') {
    const link = `${env.WEB_BASE_URL}/verify-email?token=${token}`;
    const tpl = emailTemplates.verifyEmail(lang, link);
    await sendMail({ to: user.email, ...tpl });
  } else {
    const link = `${env.WEB_BASE_URL}/reset-password?token=${token}`;
    const tpl = emailTemplates.resetPassword(lang, link);
    await sendMail({ to: user.email, ...tpl });
  }
}

export async function verifyEmail(prisma: PrismaClient, token: string): Promise<void> {
  const record = await prisma.emailToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.type !== 'VERIFY_EMAIL' || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError({ statusCode: 400, code: ErrorCode.AUTH_TOKEN_INVALID });
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
    prisma.emailToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.auditLog.create({
      data: { actorId: record.userId, action: AuditAction.EMAIL_VERIFIED, targetType: 'user', targetId: record.userId },
    }),
  ]);
}

/** Validate credentials with a generic error and no user enumeration. */
export async function login(
  prisma: PrismaClient,
  input: { email: string; password: string },
  ctx: RequestCtx,
): Promise<User> {
  const user = await prisma.user.findFirst({ where: { email: input.email, deletedAt: null } });

  // Always run a verify to keep timing uniform whether or not the user exists.
  const hash = user?.passwordHash ?? '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const valid = await verifyPassword(hash, input.password);

  if (!user || !user.passwordHash || !valid) {
    await writeAudit(prisma, {
      action: AuditAction.LOGIN_FAILURE,
      targetType: 'user',
      metadata: { email: input.email },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    throw Errors.invalidCredentials();
  }
  if (user.status === 'SUSPENDED') {
    throw new AppError({ statusCode: 403, code: ErrorCode.AUTH_ACCOUNT_SUSPENDED });
  }

  await writeAudit(prisma, {
    actorId: user.id,
    action: AuditAction.LOGIN_SUCCESS,
    targetType: 'user',
    targetId: user.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return user;
}

// ---- Refresh token rotation with reuse detection ----

export interface IssuedRefresh {
  token: string;
  expiresAt: Date;
}

/** Mint a new refresh token in a (possibly new) family, stored hashed. */
export async function issueRefreshToken(
  prisma: PrismaClient,
  userId: string,
  familyId: string,
  ctx: RequestCtx,
): Promise<IssuedRefresh> {
  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: {
      userId,
      familyId,
      tokenHash: hashToken(token),
      expiresAt,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    },
  });
  return { token, expiresAt };
}

/**
 * Rotate a refresh token. Detects reuse of an already-rotated/revoked token and,
 * if detected, revokes the entire token family (defends against theft).
 */
export async function rotateRefreshToken(
  prisma: PrismaClient,
  presentedToken: string,
  ctx: RequestCtx,
): Promise<{ user: User; refresh: IssuedRefresh }> {
  const tokenHash = hashToken(presentedToken);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!record || record.expiresAt < new Date()) {
    throw new AppError({ statusCode: 401, code: ErrorCode.AUTH_TOKEN_INVALID });
  }

  if (record.revoked) {
    // Reuse of a revoked token → compromise. Revoke the whole family.
    await prisma.refreshToken.updateMany({
      where: { familyId: record.familyId },
      data: { revoked: true },
    });
    await writeAudit(prisma, {
      actorId: record.userId,
      action: AuditAction.REFRESH_REUSE_DETECTED,
      targetType: 'user',
      targetId: record.userId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    throw new AppError({ statusCode: 401, code: ErrorCode.AUTH_REFRESH_REUSE_DETECTED });
  }

  const user = await prisma.user.findFirst({ where: { id: record.userId, deletedAt: null } });
  if (!user) throw Errors.unauthenticated();
  if (user.status === 'SUSPENDED') {
    throw new AppError({ statusCode: 403, code: ErrorCode.AUTH_ACCOUNT_SUSPENDED });
  }

  // Rotate: revoke the presented token, mint a fresh one in the same family.
  await prisma.refreshToken.update({ where: { id: record.id }, data: { revoked: true } });
  const refresh = await issueRefreshToken(prisma, user.id, record.familyId, ctx);
  return { user, refresh };
}

export async function revokeRefreshToken(prisma: PrismaClient, presentedToken: string): Promise<void> {
  const tokenHash = hashToken(presentedToken);
  await prisma.refreshToken.updateMany({ where: { tokenHash }, data: { revoked: true } });
}

export async function revokeAllRefreshTokens(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } });
}

// ---- Password reset ----

export async function forgotPassword(
  prisma: PrismaClient,
  email: string,
  ctx: RequestCtx,
): Promise<void> {
  const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  await writeAudit(prisma, {
    actorId: user?.id ?? null,
    action: AuditAction.PASSWORD_RESET_REQUESTED,
    targetType: 'user',
    targetId: user?.id ?? null,
    metadata: { email },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  // Always behave identically whether or not the user exists (no enumeration).
  if (user) {
    await issueEmailToken(prisma, user.id, 'RESET_PASSWORD', ctx.lang);
  }
}

export async function resetPassword(
  prisma: PrismaClient,
  token: string,
  newPassword: string,
  ctx: RequestCtx,
): Promise<void> {
  const record = await prisma.emailToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.type !== 'RESET_PASSWORD' || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError({ statusCode: 400, code: ErrorCode.AUTH_TOKEN_INVALID });
  }
  assertStrongPassword(newPassword);
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.emailToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Revoke all sessions after a password reset.
    prisma.refreshToken.updateMany({ where: { userId: record.userId }, data: { revoked: true } }),
  ]);
  await writeAudit(prisma, {
    actorId: record.userId,
    action: AuditAction.PASSWORD_RESET_COMPLETED,
    targetType: 'user',
    targetId: record.userId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}

export async function changePassword(
  prisma: PrismaClient,
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.passwordHash || !(await verifyPassword(user.passwordHash, currentPassword))) {
    throw Errors.invalidCredentials();
  }
  assertStrongPassword(newPassword, [user.email, user.name]);
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } }),
    prisma.auditLog.create({
      data: { actorId: userId, action: AuditAction.PASSWORD_CHANGED, targetType: 'user', targetId: userId },
    }),
  ]);
}

/** Public projection of a user for auth responses. */
export function toAuthUser(user: User): {
  id: string;
  email: string;
  name: string;
  role: User['role'];
  status: User['status'];
  branchId: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  createdAt: string;
} {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    branchId: user.branchId,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
  };
}
