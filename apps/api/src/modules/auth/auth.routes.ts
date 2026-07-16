import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { User } from '@prisma/client';
import {
  signupSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  authTokensSchema,
  authUserSchema,
  okSchema,
  z,
} from './schema-imports.js';
import { env } from '../../config/env.js';
import * as authService from './auth.service.js';
import { setRefreshCookie, clearRefreshCookie, REFRESH_COOKIE } from './cookies.js';
import { AuditAction } from '../../lib/audit.js';
import { Errors } from '../../lib/errors.js';

function detectLang(req: FastifyRequest): 'en' | 'fr' {
  const header = (req.headers['accept-language'] ?? '').toString().toLowerCase();
  return header.startsWith('fr') ? 'fr' : 'en';
}

function ctxOf(req: FastifyRequest): authService.RequestCtx {
  return { ip: req.ip, userAgent: req.headers['user-agent'] ?? null, lang: detectLang(req) };
}

/** Sign an access token and set a rotating refresh cookie for `user`. */
async function establishSession(
  app: FastifyInstance,
  reply: FastifyReply,
  user: User,
  ctx: authService.RequestCtx,
  familyId = randomUUID(),
): Promise<{ accessToken: string }> {
  const accessToken = app.jwt.sign({
    sub: user.id,
    role: user.role,
    emailVerified: user.emailVerified,
  });
  const refresh = await authService.issueRefreshToken(app.prisma, user.id, familyId, ctx);
  setRefreshCookie(reply, refresh.token, refresh.expiresAt);
  return { accessToken };
}

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  const authRateLimit = {
    rateLimit: { max: env.RATE_LIMIT_AUTH_MAX, timeWindow: env.RATE_LIMIT_AUTH_WINDOW },
  };

  // --- Signup ---
  app.post(
    '/signup',
    {
      config: authRateLimit,
      schema: {
        tags: ['auth'],
        body: signupSchema,
        response: { 201: okSchema },
      },
    },
    async (req, reply) => {
      await authService.signup(app.prisma, req.body, ctxOf(req));
      return reply.code(201).send({ ok: true as const });
    },
  );

  // --- Verify email ---
  app.post(
    '/verify-email',
    { schema: { tags: ['auth'], body: verifyEmailSchema, response: { 200: okSchema } } },
    async (req) => {
      await authService.verifyEmail(app.prisma, req.body.token);
      return { ok: true as const };
    },
  );

  // --- Login ---
  app.post(
    '/login',
    {
      config: authRateLimit,
      schema: { tags: ['auth'], body: loginSchema, response: { 200: authTokensSchema } },
    },
    async (req, reply) => {
      const user = await authService.login(app.prisma, req.body, ctxOf(req));
      const { accessToken } = await establishSession(app, reply, user, ctxOf(req));
      return reply.send({ accessToken, user: authService.toAuthUser(user) });
    },
  );

  // --- CSRF token issuance (for cookie-based mutations) ---
  app.get(
    '/csrf',
    { schema: { tags: ['auth'], response: { 200: z.object({ csrfToken: z.string() }) } } },
    async (_req, reply) => {
      const csrfToken = await reply.generateCsrf();
      return reply.send({ csrfToken });
    },
  );

  // --- Refresh (cookie + CSRF protected) ---
  app.post(
    '/refresh',
    {
      onRequest: app.csrfProtection,
      schema: { tags: ['auth'], response: { 200: authTokensSchema } },
    },
    async (req, reply) => {
      const presented = req.cookies[REFRESH_COOKIE];
      if (!presented) throw Errors.unauthenticated();
      const { user, refresh } = await authService.rotateRefreshToken(
        app.prisma,
        presented,
        ctxOf(req),
      );
      setRefreshCookie(reply, refresh.token, refresh.expiresAt);
      const accessToken = app.jwt.sign({
        sub: user.id,
        role: user.role,
        emailVerified: user.emailVerified,
      });
      return reply.send({ accessToken, user: authService.toAuthUser(user) });
    },
  );

  // --- Logout (revoke current refresh token) ---
  app.post(
    '/logout',
    { onRequest: app.csrfProtection, schema: { tags: ['auth'], response: { 200: okSchema } } },
    async (req, reply) => {
      const presented = req.cookies[REFRESH_COOKIE];
      if (presented) await authService.revokeRefreshToken(app.prisma, presented);
      clearRefreshCookie(reply);
      await req.audit(AuditAction.LOGOUT);
      return reply.send({ ok: true as const });
    },
  );

  // --- Logout all devices (revoke whole family set for the user) ---
  app.post(
    '/logout-all',
    { onRequest: app.authenticate, schema: { tags: ['auth'], response: { 200: okSchema } } },
    async (req, reply) => {
      await authService.revokeAllRefreshTokens(app.prisma, req.authUser!.id);
      clearRefreshCookie(reply);
      await req.audit(AuditAction.LOGOUT_ALL);
      return reply.send({ ok: true as const });
    },
  );

  // --- Forgot password (always 200, no enumeration) ---
  app.post(
    '/forgot-password',
    {
      config: authRateLimit,
      schema: { tags: ['auth'], body: forgotPasswordSchema, response: { 200: okSchema } },
    },
    async (req) => {
      await authService.forgotPassword(app.prisma, req.body.email, ctxOf(req));
      return { ok: true as const };
    },
  );

  // --- Reset password ---
  app.post(
    '/reset-password',
    {
      config: authRateLimit,
      schema: { tags: ['auth'], body: resetPasswordSchema, response: { 200: okSchema } },
    },
    async (req) => {
      await authService.resetPassword(app.prisma, req.body.token, req.body.password, ctxOf(req));
      return { ok: true as const };
    },
  );

  // --- Change password (authenticated) ---
  app.post(
    '/change-password',
    {
      onRequest: app.authenticate,
      schema: { tags: ['auth'], body: changePasswordSchema, response: { 200: okSchema } },
    },
    async (req, reply) => {
      await authService.changePassword(
        app.prisma,
        req.authUser!.id,
        req.body.currentPassword,
        req.body.newPassword,
      );
      clearRefreshCookie(reply);
      return reply.send({ ok: true as const });
    },
  );

  // --- Current user ---
  app.get(
    '/me',
    { onRequest: app.authenticate, schema: { tags: ['auth'], response: { 200: authUserSchema } } },
    async (req) => {
      const user = await app.prisma.user.findUniqueOrThrow({ where: { id: req.authUser!.id } });
      return authService.toAuthUser(user);
    },
  );

  // --- Google OAuth ---
  await registerGoogleOAuth(app, establishSession);
}

/**
 * Google OAuth (Authorization Code flow). Registered only when credentials are
 * configured. The callback verifies the profile, links or creates the user by
 * googleId / verified email, and establishes a session.
 */
async function registerGoogleOAuth(
  app: FastifyInstance,
  establish: typeof establishSession,
): Promise<void> {
  const { googleOAuthEnabled } = await import('../../config/env.js');
  if (!googleOAuthEnabled) {
    app.log.info('Google OAuth disabled (no GOOGLE_CLIENT_ID/SECRET set)');
    return;
  }
  const { registerGoogle } = await import('./google.js');
  await registerGoogle(app, establish);
}
