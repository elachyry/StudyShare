import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role, UserStatus } from '@studyshare/shared';
import { ErrorCode } from '@studyshare/shared';
import { env } from '../config/env.js';
import { AppError, Errors } from '../lib/errors.js';
import { requestContext } from '@fastify/request-context';

/** Claims embedded in the short-lived access token. */
export interface AccessTokenPayload {
  sub: string;
  role: Role;
  emailVerified: boolean;
}

/** The authenticated principal attached to `req.user` after `authenticate`. */
export interface AuthenticatedUser {
  id: string;
  role: Role;
  email: string;
  emailVerified: boolean;
  status: UserStatus;
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthenticatedUser;
  }
  interface FastifyInstance {
    /** Require a valid access token; loads the fresh user (so suspensions and
     * role changes take effect immediately, not at token expiry). */
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** Attach the user if a valid token is present, but never reject. */
    optionalAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    /** Additionally require a verified email (e.g. before uploading). */
    requireVerified: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

export default fp(
  async (app) => {
    await app.register(fastifyJwt, {
      secret: env.JWT_ACCESS_SECRET,
      sign: {
        expiresIn: env.JWT_ACCESS_TTL,
        iss: env.JWT_ISSUER,
        aud: env.JWT_AUDIENCE,
      },
      verify: { allowedIss: env.JWT_ISSUER, allowedAud: env.JWT_AUDIENCE },
    });

    async function loadUser(req: FastifyRequest): Promise<AuthenticatedUser> {
      let payload: AccessTokenPayload;
      try {
        payload = await req.jwtVerify<AccessTokenPayload>();
      } catch (err) {
        const code =
          err && typeof err === 'object' && 'code' in err && err.code === 'FAST_JWT_EXPIRED'
            ? ErrorCode.AUTH_TOKEN_EXPIRED
            : ErrorCode.AUTH_TOKEN_INVALID;
        throw new AppError({ statusCode: 401, code });
      }

      const user = await app.prisma.user.findFirst({
        where: { id: payload.sub, deletedAt: null },
        select: { id: true, role: true, email: true, emailVerified: true, status: true },
      });
      if (!user) throw Errors.unauthenticated();
      if (user.status === 'SUSPENDED') {
        throw new AppError({ statusCode: 403, code: ErrorCode.AUTH_ACCOUNT_SUSPENDED });
      }
      return user;
    }

    app.decorate('authenticate', async (req: FastifyRequest, _reply: FastifyReply) => {
      const user = await loadUser(req);
      req.authUser = user;
      requestContext.set('userId', user.id);
    });

    app.decorate('optionalAuth', async (req) => {
      if (!req.headers.authorization) return;
      try {
        const user = await loadUser(req);
        req.authUser = user;
        requestContext.set('userId', user.id);
      } catch {
        // Ignore — anonymous access is allowed on optional-auth routes.
      }
    });

    app.decorate('requireVerified', async (req, reply) => {
      await app.authenticate(req, reply);
      if (req.authUser && !req.authUser.emailVerified) {
        throw new AppError({ statusCode: 403, code: ErrorCode.AUTH_EMAIL_NOT_VERIFIED });
      }
    });
  },
  { name: 'auth', dependencies: ['prisma'] },
);
