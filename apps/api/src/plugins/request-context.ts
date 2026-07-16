import fp from 'fastify-plugin';
import { fastifyRequestContext, requestContext } from '@fastify/request-context';

declare module '@fastify/request-context' {
  interface RequestContextData {
    requestId: string;
    userId?: string;
  }
}

/**
 * Provides an async-local request context and a stable correlation id per
 * request. The id is echoed back in the `x-request-id` response header and used
 * in error bodies for traceability.
 */
export default fp(
  async (app) => {
    await app.register(fastifyRequestContext);

    app.addHook('onRequest', async (req, reply) => {
      const incoming = req.headers['x-request-id'];
      const requestId = (Array.isArray(incoming) ? incoming[0] : incoming) || req.id;
      requestContext.set('requestId', requestId);
      reply.header('x-request-id', requestId);
    });
  },
  { name: 'request-context' },
);

export function currentRequestId(): string | undefined {
  return requestContext.get('requestId');
}
