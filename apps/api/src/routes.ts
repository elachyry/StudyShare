import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { authRoutes } from './modules/auth/auth.routes.js';

/**
 * Registers all feature routes under the `/api` prefix. Each module owns its own
 * route registrar; new modules are added here as they are built.
 */
export const registerRoutes: FastifyPluginAsyncZod = async (app) => {
  await app.register(authRoutes, { prefix: '/auth' });
};
