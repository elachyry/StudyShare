import type { FastifyInstance, FastifyReply } from 'fastify';
import type { User } from '@prisma/client';
import fastifyOauth2, { type OAuth2Namespace } from '@fastify/oauth2';
import { env } from '../../config/env.js';
import { AuditAction, writeAudit } from '../../lib/audit.js';
import type { RequestCtx } from './auth.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    googleOAuth2: OAuth2Namespace;
  }
}

interface GoogleProfile {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

/**
 * Fetches the Google userinfo for an access token. Extracted so tests can mock
 * the network call (`vi.spyOn(googleModule, 'fetchGoogleProfile')`).
 */
export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`google userinfo failed: ${res.status}`);
  return (await res.json()) as GoogleProfile;
}

/**
 * Match or create a user from a verified Google profile. Links to an existing
 * account when the verified email matches (account linking).
 */
export async function upsertGoogleUser(
  app: FastifyInstance,
  profile: GoogleProfile,
): Promise<User> {
  const email = profile.email.toLowerCase();

  const byGoogle = await app.prisma.user.findUnique({ where: { googleId: profile.sub } });
  if (byGoogle) return byGoogle;

  const byEmail = await app.prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    return app.prisma.user.update({
      where: { id: byEmail.id },
      data: {
        googleId: profile.sub,
        emailVerified: byEmail.emailVerified || profile.email_verified,
        avatarUrl: byEmail.avatarUrl ?? profile.picture ?? null,
      },
    });
  }

  return app.prisma.user.create({
    data: {
      email,
      googleId: profile.sub,
      name: profile.name ?? email.split('@')[0]!,
      avatarUrl: profile.picture ?? null,
      emailVerified: profile.email_verified,
    },
  });
}

export async function registerGoogle(
  app: FastifyInstance,
  establish: (
    app: FastifyInstance,
    reply: FastifyReply,
    user: User,
    ctx: RequestCtx,
  ) => Promise<{ accessToken: string }>,
): Promise<void> {
  await app.register(fastifyOauth2, {
    name: 'googleOAuth2',
    scope: ['openid', 'email', 'profile'],
    credentials: {
      client: { id: env.GOOGLE_CLIENT_ID!, secret: env.GOOGLE_CLIENT_SECRET! },
      auth: fastifyOauth2.GOOGLE_CONFIGURATION,
    },
    startRedirectPath: '/google',
    callbackUri: `${env.API_BASE_URL}${env.GOOGLE_REDIRECT_PATH}`,
  });

  // Callback: exchange the code, fetch the profile, upsert, establish session,
  // then redirect back to the web app which reads the access token.
  app.get('/google/callback', async (req, reply) => {
    try {
      const { token } =
        await app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(req);
      const profile = await fetchGoogleProfile(token.access_token);
      if (!profile.email_verified) {
        return reply.redirect(`${env.WEB_BASE_URL}/login?error=AUTH_OAUTH_FAILED`);
      }
      const user = await upsertGoogleUser(app, profile);
      const ctx: RequestCtx = {
        ip: req.ip,
        userAgent: req.headers['user-agent'] ?? null,
        lang: 'en',
      };
      const { accessToken } = await establish(app, reply, user, ctx);
      await writeAudit(app.prisma, {
        actorId: user.id,
        action: AuditAction.OAUTH_LOGIN,
        targetType: 'user',
        targetId: user.id,
        ip: req.ip,
        userAgent: req.headers['user-agent'] ?? null,
      });
      // Hand the short-lived access token to the SPA via URL fragment (not query,
      // to keep it out of server logs/referrers). The refresh cookie is already set.
      return reply.redirect(`${env.WEB_BASE_URL}/oauth/callback#access_token=${accessToken}`);
    } catch (err) {
      req.log.error({ err }, 'google oauth callback failed');
      return reply.redirect(`${env.WEB_BASE_URL}/login?error=AUTH_OAUTH_FAILED`);
    }
  });
}
