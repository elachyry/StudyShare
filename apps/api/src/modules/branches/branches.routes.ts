import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  Permission,
  branchSchema,
  subjectSchema,
  createBranchSchema,
  updateBranchSchema,
  createSubjectSchema,
  updateSubjectSchema,
  okSchema,
  ErrorCode,
} from '@studyshare/shared';
import { serializeBranch, serializeSubject } from '../../lib/serializers.js';
import { AppError, Errors } from '../../lib/errors.js';
import { AuditAction } from '../../lib/audit.js';

/**
 * Branches & subjects. Reads are public (needed for browse filters); writes are
 * admin-only (BRANCH_MANAGE) and audited.
 */
export const branchRoutes: FastifyPluginAsyncZod = async (app) => {
  // --- Public reads ---
  app.get(
    '/',
    { schema: { tags: ['branches'], response: { 200: z.array(branchSchema) } } },
    async () => {
      const branches = await app.prisma.branch.findMany({ orderBy: { name: 'asc' } });
      return branches.map(serializeBranch);
    },
  );

  app.get(
    '/:branchId/subjects',
    {
      schema: {
        tags: ['branches'],
        params: z.object({ branchId: z.string() }),
        response: { 200: z.array(subjectSchema) },
      },
    },
    async (req) => {
      const subjects = await app.prisma.subject.findMany({
        where: { branchId: req.params.branchId },
        orderBy: { name: 'asc' },
      });
      return subjects.map(serializeSubject);
    },
  );

  // --- Admin: branch CRUD ---
  app.post(
    '/',
    {
      preHandler: app.authorize(Permission.BRANCH_MANAGE),
      schema: { tags: ['branches'], body: createBranchSchema, response: { 201: branchSchema } },
    },
    async (req, reply) => {
      const existing = await app.prisma.branch.findUnique({ where: { slug: req.body.slug } });
      if (existing) throw Errors.conflict();
      const branch = await app.prisma.branch.create({ data: req.body });
      await req.audit(AuditAction.BRANCH_CREATE, { targetType: 'branch', targetId: branch.id });
      return reply.code(201).send(serializeBranch(branch));
    },
  );

  app.patch(
    '/:branchId',
    {
      preHandler: app.authorize(Permission.BRANCH_MANAGE),
      schema: {
        tags: ['branches'],
        params: z.object({ branchId: z.string() }),
        body: updateBranchSchema,
        response: { 200: branchSchema },
      },
    },
    async (req) => {
      const branch = await app.prisma.branch
        .update({ where: { id: req.params.branchId }, data: req.body })
        .catch(() => {
          throw Errors.notFound();
        });
      await req.audit(AuditAction.BRANCH_UPDATE, { targetType: 'branch', targetId: branch.id });
      return serializeBranch(branch);
    },
  );

  app.delete(
    '/:branchId',
    {
      preHandler: app.authorize(Permission.BRANCH_MANAGE),
      schema: {
        tags: ['branches'],
        params: z.object({ branchId: z.string() }),
        response: { 200: okSchema },
      },
    },
    async (req) => {
      // Guard: refuse to delete a branch that still has resources/requests.
      const inUse = await app.prisma.resource.count({ where: { branchId: req.params.branchId } });
      if (inUse > 0) throw new AppError({ statusCode: 409, code: ErrorCode.CONFLICT });
      await app.prisma.branch.delete({ where: { id: req.params.branchId } }).catch(() => {
        throw Errors.notFound();
      });
      await req.audit(AuditAction.BRANCH_DELETE, {
        targetType: 'branch',
        targetId: req.params.branchId,
      });
      return { ok: true as const };
    },
  );

  // --- Admin: subject CRUD ---
  app.post(
    '/subjects',
    {
      preHandler: app.authorize(Permission.BRANCH_MANAGE),
      schema: { tags: ['branches'], body: createSubjectSchema, response: { 201: subjectSchema } },
    },
    async (req, reply) => {
      const branch = await app.prisma.branch.findUnique({ where: { id: req.body.branchId } });
      if (!branch) throw Errors.notFound();
      const clash = await app.prisma.subject.findUnique({
        where: { branchId_slug: { branchId: req.body.branchId, slug: req.body.slug } },
      });
      if (clash) throw Errors.conflict();
      const subject = await app.prisma.subject.create({ data: req.body });
      await req.audit(AuditAction.SUBJECT_CREATE, {
        targetType: 'subject',
        targetId: subject.id,
      });
      return reply.code(201).send(serializeSubject(subject));
    },
  );

  app.patch(
    '/subjects/:subjectId',
    {
      preHandler: app.authorize(Permission.BRANCH_MANAGE),
      schema: {
        tags: ['branches'],
        params: z.object({ subjectId: z.string() }),
        body: updateSubjectSchema,
        response: { 200: subjectSchema },
      },
    },
    async (req) => {
      const subject = await app.prisma.subject
        .update({ where: { id: req.params.subjectId }, data: req.body })
        .catch(() => {
          throw Errors.notFound();
        });
      await req.audit(AuditAction.SUBJECT_UPDATE, {
        targetType: 'subject',
        targetId: subject.id,
      });
      return serializeSubject(subject);
    },
  );

  app.delete(
    '/subjects/:subjectId',
    {
      preHandler: app.authorize(Permission.BRANCH_MANAGE),
      schema: {
        tags: ['branches'],
        params: z.object({ subjectId: z.string() }),
        response: { 200: okSchema },
      },
    },
    async (req) => {
      const inUse = await app.prisma.resource.count({
        where: { subjectId: req.params.subjectId },
      });
      if (inUse > 0) throw new AppError({ statusCode: 409, code: ErrorCode.CONFLICT });
      await app.prisma.subject.delete({ where: { id: req.params.subjectId } }).catch(() => {
        throw Errors.notFound();
      });
      await req.audit(AuditAction.SUBJECT_DELETE, {
        targetType: 'subject',
        targetId: req.params.subjectId,
      });
      return { ok: true as const };
    },
  );
};
