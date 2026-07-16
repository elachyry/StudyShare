import fp from 'fastify-plugin';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';
import { env } from '../config/env.js';

/**
 * OpenAPI 3 docs generated from the Zod route schemas, served at /docs.
 */
export default fp(
  async (app) => {
    await app.register(fastifySwagger, {
      openapi: {
        info: {
          title: 'StudyShare API',
          description: 'Secure academic resource sharing platform.',
          version: '1.0.0',
        },
        servers: [{ url: env.API_BASE_URL }],
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          },
        },
      },
      transform: jsonSchemaTransform,
    });

    await app.register(fastifySwaggerUi, {
      routePrefix: '/docs',
      uiConfig: { docExpansion: 'list', deepLinking: true },
    });
  },
  { name: 'swagger' },
);
