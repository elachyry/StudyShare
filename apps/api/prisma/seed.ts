/**
 * Seed script: creates an admin, a moderator, sample students, several bilingual
 * branches/subjects, and a handful of approved resources + open requests so the
 * app is explorable immediately after `docker compose up`.
 *
 * Documented credentials (dev only):
 *   admin@studyshare.local     / Admin!Pass123
 *   moderator@studyshare.local / Moderator!Pass123
 *   student@studyshare.local   / Student!Pass123
 */
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { putObject, ensureBucket } from '../src/lib/storage.js';

const prisma = new PrismaClient();

async function hash(pw: string): Promise<string> {
  return argon2.hash(pw, { type: argon2.argon2id });
}

async function main(): Promise<void> {
  // Idempotency guard: some entities below use create() (not upsert), so running
  // the seed on an already-seeded database would duplicate them. Bail early if
  // data already exists. Use `db:reset` to wipe and re-seed from scratch.
  if ((await prisma.resource.count()) > 0) {
    console.log('Database already seeded; skipping.');
    return;
  }

  // Users -------------------------------------------------------------------
  const [adminPw, modPw, studentPw] = await Promise.all([
    hash('Admin!Pass123'),
    hash('Moderator!Pass123'),
    hash('Student!Pass123'),
  ]);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@studyshare.local' },
    update: {},
    create: {
      email: 'admin@studyshare.local',
      name: 'Site Admin',
      passwordHash: adminPw,
      role: 'ADMIN',
      emailVerified: true,
    },
  });

  const moderator = await prisma.user.upsert({
    where: { email: 'moderator@studyshare.local' },
    update: {},
    create: {
      email: 'moderator@studyshare.local',
      name: 'Mod Erator',
      passwordHash: modPw,
      role: 'MODERATOR',
      emailVerified: true,
    },
  });

  const student = await prisma.user.upsert({
    where: { email: 'student@studyshare.local' },
    update: {},
    create: {
      email: 'student@studyshare.local',
      name: 'Sam Student',
      passwordHash: studentPw,
      role: 'STUDENT',
      emailVerified: true,
    },
  });

  const student2 = await prisma.user.upsert({
    where: { email: 'lea@studyshare.local' },
    update: {},
    create: {
      email: 'lea@studyshare.local',
      name: 'Léa Étudiante',
      passwordHash: studentPw,
      role: 'STUDENT',
      emailVerified: true,
    },
  });

  // Branches & subjects (bilingual) ----------------------------------------
  const branchesSeed = [
    {
      slug: 'computer-science',
      name: 'Computer Science',
      nameFr: 'Informatique',
      description: 'Algorithms, systems, and software engineering.',
      subjects: [
        { slug: 'algorithms', name: 'Algorithms', nameFr: 'Algorithmique' },
        { slug: 'databases', name: 'Databases', nameFr: 'Bases de données' },
        { slug: 'operating-systems', name: 'Operating Systems', nameFr: "Systèmes d'exploitation" },
      ],
    },
    {
      slug: 'medicine',
      name: 'Medicine',
      nameFr: 'Médecine',
      description: 'Foundational and clinical medical sciences.',
      subjects: [
        { slug: 'anatomy', name: 'Anatomy', nameFr: 'Anatomie' },
        { slug: 'physiology', name: 'Physiology', nameFr: 'Physiologie' },
      ],
    },
    {
      slug: 'law',
      name: 'Law',
      nameFr: 'Droit',
      description: 'Public and private law fundamentals.',
      subjects: [
        { slug: 'constitutional-law', name: 'Constitutional Law', nameFr: 'Droit constitutionnel' },
        { slug: 'civil-law', name: 'Civil Law', nameFr: 'Droit civil' },
      ],
    },
  ];

  const subjectIds: Record<string, string> = {};
  const branchIds: Record<string, string> = {};
  for (const b of branchesSeed) {
    const branch = await prisma.branch.upsert({
      where: { slug: b.slug },
      update: { name: b.name, nameFr: b.nameFr, description: b.description },
      create: { slug: b.slug, name: b.name, nameFr: b.nameFr, description: b.description },
    });
    branchIds[b.slug] = branch.id;
    for (const s of b.subjects) {
      const subject = await prisma.subject.upsert({
        where: { branchId_slug: { branchId: branch.id, slug: s.slug } },
        update: { name: s.name, nameFr: s.nameFr },
        create: { branchId: branch.id, slug: s.slug, name: s.name, nameFr: s.nameFr },
      });
      subjectIds[`${b.slug}/${s.slug}`] = subject.id;
    }
  }

  // Sample resources (with real placeholder files in storage) ---------------
  try {
    await ensureBucket();
  } catch {
    console.warn('storage bucket not reachable; seeding resource rows without uploads');
  }

  const resourcesSeed = [
    {
      title: 'Big-O Cheat Sheet',
      description: 'A one-page summary of common time complexities.',
      type: 'SUMMARY' as const,
      branch: 'computer-science',
      subject: 'computer-science/algorithms',
      uploaderId: student.id,
    },
    {
      title: 'Dijkstra Practice Problems',
      description: 'Ten graded exercises on shortest paths.',
      type: 'EXERCISE' as const,
      branch: 'computer-science',
      subject: 'computer-science/algorithms',
      uploaderId: student2.id,
    },
    {
      title: 'Skeletal System Lecture Notes',
      description: 'Full lesson notes on the human skeletal system.',
      type: 'LESSON' as const,
      branch: 'medicine',
      subject: 'medicine/anatomy',
      uploaderId: student.id,
    },
  ];

  for (const r of resourcesSeed) {
    const existing = await prisma.resource.findFirst({ where: { title: r.title } });
    if (existing) continue;

    const content = Buffer.from(
      `StudyShare sample resource\n\n${r.title}\n\n${r.description}\n`,
      'utf8',
    );
    const checksum = createHash('sha256').update(content).digest('hex');
    const storageKey = `${randomUUID()}.txt`;
    try {
      await putObject({
        key: storageKey,
        body: content,
        contentType: 'text/plain',
        originalName: `${r.title}.txt`,
      });
    } catch {
      // Storage optional during seed; the row still lets browse work.
    }

    const file = await prisma.fileObject.create({
      data: {
        storageKey,
        originalName: `${r.title}.txt`,
        mimeType: 'text/plain',
        sizeBytes: content.length,
        checksum,
        uploaderId: r.uploaderId,
        scanned: true,
      },
    });

    await prisma.resource.create({
      data: {
        title: r.title,
        description: r.description,
        type: r.type,
        status: 'APPROVED',
        branchId: branchIds[r.branch]!,
        subjectId: subjectIds[r.subject]!,
        uploaderId: r.uploaderId,
        fileId: file.id,
        downloadsCount: Math.floor(Math.random() * 40),
      },
    });
  }

  // Sample open requests ----------------------------------------------------
  const requestsSeed = [
    {
      title: 'Need summary of B-Trees',
      description: 'Struggling with B-Tree insertion/deletion — a concise summary would help!',
      type: 'SUMMARY' as const,
      branch: 'computer-science',
      subject: 'computer-science/databases',
      requesterId: student.id,
    },
    {
      title: 'Cardiac cycle exercises',
      description: 'Looking for practice questions on the cardiac cycle.',
      type: 'EXERCISE' as const,
      branch: 'medicine',
      subject: 'medicine/physiology',
      requesterId: student2.id,
    },
  ];

  for (const rq of requestsSeed) {
    const exists = await prisma.resourceRequest.findFirst({ where: { title: rq.title } });
    if (exists) continue;
    const request = await prisma.resourceRequest.create({
      data: {
        title: rq.title,
        description: rq.description,
        type: rq.type,
        branchId: branchIds[rq.branch]!,
        subjectId: subjectIds[rq.subject]!,
        requesterId: rq.requesterId,
      },
    });
    // A couple of upvotes.
    await prisma.requestVote.createMany({
      data: [
        { requestId: request.id, userId: admin.id },
        { requestId: request.id, userId: moderator.id },
      ],
      skipDuplicates: true,
    });
  }

  console.log('✔ Seed complete.');
  console.log('  admin@studyshare.local / Admin!Pass123');
  console.log('  moderator@studyshare.local / Moderator!Pass123');
  console.log('  student@studyshare.local / Student!Pass123');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
