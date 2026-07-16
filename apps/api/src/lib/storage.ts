import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'node:stream';
import { env } from '../config/env.js';

/**
 * S3-compatible object storage client (MinIO in dev). The bucket is PRIVATE:
 * objects are never publicly readable and are served only via short-lived
 * signed URLs. Force path-style addressing for MinIO compatibility.
 */
export const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
});

/** Ensure the private bucket exists (idempotent). Called at boot. */
export async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
  }
}

export async function putObject(params: {
  key: string;
  body: Buffer;
  contentType: string;
  originalName: string;
}): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      // Force browsers to download rather than render (defends against stored XSS
      // via HTML/SVG) and disable content sniffing.
      ContentDisposition: `attachment; filename="${sanitizeHeaderValue(params.originalName)}"`,
      Metadata: { originalname: encodeURIComponent(params.originalName) },
    }),
  );
}

export async function getObjectStream(key: string): Promise<Readable> {
  const res = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  return res.Body as Readable;
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}

/** Generate a short-lived signed GET URL for a private object. */
export async function getDownloadUrl(
  key: string,
  originalName: string,
): Promise<{ url: string; expiresInSeconds: number }> {
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${sanitizeHeaderValue(originalName)}"`,
    ResponseContentType: 'application/octet-stream',
  });
  const url = await getSignedUrl(s3, command, { expiresIn: env.DOWNLOAD_URL_TTL_SECONDS });
  return { url, expiresInSeconds: env.DOWNLOAD_URL_TTL_SECONDS };
}

/** Strip characters that could break or inject into an HTTP header value. */
function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n"\\]/g, '_').slice(0, 200);
}

export async function checkStorageReady(): Promise<boolean> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
    return true;
  } catch {
    return false;
  }
}
