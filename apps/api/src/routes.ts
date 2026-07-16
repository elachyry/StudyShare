import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { authRoutes } from './modules/auth/auth.routes.js';
import { fileRoutes } from './modules/files/files.routes.js';
import { branchRoutes } from './modules/branches/branches.routes.js';
import { resourceRoutes } from './modules/resources/resources.routes.js';
import { reportRoutes } from './modules/reports/reports.routes.js';

/**
 * Registers all feature routes under the `/api` prefix. Each module owns its own
 * route registrar; new modules are added here as they are built.
 */
export const registerRoutes: FastifyPluginAsyncZod = async (app) => {
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(fileRoutes, { prefix: '/files' });
  await app.register(branchRoutes, { prefix: '/branches' });
  await app.register(resourceRoutes, { prefix: '/resources' });
  await app.register(reportRoutes, { prefix: '/reports' });
};
