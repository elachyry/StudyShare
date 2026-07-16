import fp from 'fastify-plugin';
import multipart from '@fastify/multipart';
import { env } from '../config/env.js';

/**
 * Multipart uploads with a hard byte ceiling enforced at the parser level
 * (`limits.fileSize`), so oversized streams are aborted early rather than fully
 * buffered. One file per request; extra parts are rejected.
 */
export default fp(
  async (app) => {
    await app.register(multipart, {
      limits: {
        fileSize: env.MAX_UPLOAD_BYTES,
        files: 1,
        fields: 10,
        fieldSize: 1024 * 100,
      },
    });
  },
  { name: 'multipart' },
);
