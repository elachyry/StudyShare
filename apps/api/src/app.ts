import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
  hasZodFastifySchemaValidationErrors,
} from 'fastify-type-provider-zod';
import { ZodError } from 'zod';
import { ErrorCode, type ApiErrorBody } from '@studyshare/shared';

import { env, isProd } from './config/env.js';
import { loggerOptions } from './lib/logger.js';
import { AppError } from './lib/errors.js';
import { captureException } from './lib/reporter.js';
import { currentRequestId } from './plugins/request-context.js';

import requestContextPlugin from './plugins/request-context.js';
import prismaPlugin from './plugins/prisma.js';
import swaggerPlugin from './plugins/swagger.js';
import authPlugin from './plugins/auth.js';
import rbacPlugin from './plugins/rbac.js';
import csrfPlugin from './plugins/csrf.js';
import auditPlugin from './plugins/audit.js';
import { registerRoutes } from './routes.js';
import { healthRoutes } from './modules/health/health.routes.js';

/**
 * Application factory. Returns a fully-wired Fastify instance WITHOUT listening,
 * so tests can `inject()` against it and the entrypoint can `listen()`.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: loggerOptions,
    trustProxy: true,
    genReqId: (req) => {
      const header = req.headers['x-request-id'];
      return (Array.isArray(header) ? header[0] : header) || crypto.randomUUID();
    },
    bodyLimit: 1024 * 1024, // 1 MB for JSON bodies; multipart handled separately
  }).withTypeProvider<ZodTypeProvider>();

  // Zod as the single validation + serialization engine.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Correlation id + async context (must be early).
  await app.register(requestContextPlugin);

  // Security headers. CSP is strict; the API serves JSON + Swagger UI only.
  await app.register(helmet, {
    contentSecurityPolicy: isProd
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:'],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
          },
        }
      : false, // relaxed so Swagger UI works in dev
    crossOriginResourcePolicy: { policy: 'same-site' },
    hsts: isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
  });

  // Strict CORS allowlist; credentials enabled for cookie-based refresh.
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'x-request-id'],
  });

  await app.register(cookie, {
    secret: env.COOKIE_SECRET,
    parseOptions: { httpOnly: true, sameSite: 'strict', secure: env.COOKIE_SECURE, path: '/' },
  });

  // Global rate limit (auth/upload routes tighten this per-route).
  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_GLOBAL_MAX,
    timeWindow: env.RATE_LIMIT_GLOBAL_WINDOW,
    keyGenerator: (req) => req.ip,
  });

  await app.register(swaggerPlugin);
  await app.register(prismaPlugin);
  await app.register(csrfPlugin);
  await app.register(authPlugin);
  await app.register(rbacPlugin);
  await app.register(auditPlugin);

  // Central error/not-found handlers. These MUST be registered BEFORE routes:
  // Fastify binds the active error handler to each route at registration time.
  app.setErrorHandler((error, req, reply) => {
    const requestId = currentRequestId();

    // Zod validation failures from typed routes.
    if (hasZodFastifySchemaValidationErrors(error)) {
      const body: ApiErrorBody = {
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Request validation failed',
          details: error.validation,
          requestId,
        },
      };
      return reply.code(400).send(body);
    }
    if (error instanceof ZodError) {
      const body: ApiErrorBody = {
        error: { code: ErrorCode.VALIDATION_ERROR, details: error.issues, requestId },
      };
      return reply.code(400).send(body);
    }

    if (error instanceof AppError) {
      const body: ApiErrorBody = {
        error: {
          code: error.code,
          message: error.expose ? error.message : undefined,
          details: error.expose ? error.details : undefined,
          requestId,
        },
      };
      return reply.code(error.statusCode).send(body);
    }

    // Fastify's own rate-limit / 4xx errors carry a statusCode.
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    if (statusCode === 429) {
      const body: ApiErrorBody = { error: { code: ErrorCode.RATE_LIMITED, requestId } };
      return reply.code(429).send(body);
    }
    if (statusCode < 500) {
      const body: ApiErrorBody = {
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: (error as Error).message,
          requestId,
        },
      };
      return reply.code(statusCode).send(body);
    }

    // Unexpected: report and return a generic 500 (never leak internals).
    captureException(error, req.log, { requestId, url: req.url });
    const body: ApiErrorBody = { error: { code: ErrorCode.INTERNAL_ERROR, requestId } };
    return reply.code(500).send(body);
  });

  app.setNotFoundHandler((_req, reply) => {
    const body: ApiErrorBody = {
      error: { code: ErrorCode.NOT_FOUND, requestId: currentRequestId() },
    };
    return reply.code(404).send(body);
  });

  // Health/readiness probes at the root (not under /api).
  await app.register(healthRoutes);

  // Feature routes (all under /api).
  await app.register(registerRoutes, { prefix: '/api' });

  return app;
}
