import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { uploadedFileSchema } from '@studyshare/shared';
import { env } from '../../config/env.js';
import { processUpload } from './files.service.js';

/**
 * File upload endpoint. Requires a verified email (uploading is blocked until
 * verification) and is rate-limited per the upload budget. The returned
 * `fileId` is then attached when creating a Resource.
 */
export const fileRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/',
    {
      onRequest: app.requireVerified,
      config: {
        rateLimit: {
          max: env.RATE_LIMIT_UPLOAD_MAX,
          timeWindow: env.RATE_LIMIT_UPLOAD_WINDOW,
        },
      },
      schema: {
        tags: ['files'],
        consumes: ['multipart/form-data'],
        response: { 201: uploadedFileSchema },
      },
    },
    async (req, reply) => {
      const result = await processUpload(req, req.authUser!.id);
      return reply.code(201).send(result);
    },
  );
};
