import type { FastifyReply } from 'fastify';
import { env } from '../../config/env.js';

/** The refresh cookie is scoped to the auth routes so it's never sent broadly. */
export const REFRESH_COOKIE = 'ss_refresh';
export const REFRESH_COOKIE_PATH = '/api/auth';

export function setRefreshCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
  reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    domain: env.COOKIE_DOMAIN,
    expires: expiresAt,
    signed: false,
  });
}

export function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH, domain: env.COOKIE_DOMAIN });
}
