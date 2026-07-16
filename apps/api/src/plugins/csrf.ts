import fp from 'fastify-plugin';
import csrfProtection from '@fastify/csrf-protection';
import { env } from '../config/env.js';

/**
 * CSRF protection using the double-submit cookie pattern. Applied only to
 * cookie-authenticated, state-changing routes (refresh, logout). Access-token
 * (Authorization header) routes are inherently CSRF-safe and are not gated.
 *
 * Frontend flow: GET /api/auth/csrf sets the csrf cookie + returns the token;
 * the client echoes it in the `x-csrf-token` header on protected mutations.
 */
export default fp(
  async (app) => {
    await app.register(csrfProtection, {
      cookieOpts: {
        signed: true,
        httpOnly: false, // must be readable by JS to echo back in the header
        sameSite: 'strict',
        secure: env.COOKIE_SECURE,
        path: '/',
      },
      getToken: (req) => {
        const header = req.headers['x-csrf-token'];
        return Array.isArray(header) ? header[0] : header;
      },
    });
  },
  { name: 'csrf', dependencies: ['@fastify/cookie'] },
);
