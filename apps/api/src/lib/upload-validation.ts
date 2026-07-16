import { fileTypeFromBuffer } from 'file-type';
import { ErrorCode } from '@studyshare/shared';
import { AppError } from './errors.js';

/**
 * Extension allowlist (never a denylist). Maps each allowed extension to the
 * Content-Type values a browser may legitimately declare for it. Anything not
 * listed here is rejected outright.
 */
export const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  pdf: ['application/pdf'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ppt: ['application/vnd.ms-powerpoint'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  xls: ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  txt: ['text/plain'],
  md: ['text/markdown', 'text/x-markdown', 'text/plain'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  zip: ['application/zip', 'application/x-zip-compressed'],
};

/**
 * For each extension, the set of `file-type` detected extensions that are
 * acceptable when sniffing the real bytes. `allowUndefined` is true only for
 * formats with no magic signature (plain text / markdown).
 *
 * - OOXML (docx/xlsx/pptx) are ZIP containers → may sniff as the specific type
 *   or generically as `zip`.
 * - Legacy Office (doc/xls/ppt) are OLE2 compound files → sniff as `cfb`.
 */
const EXPECTED_MAGIC: Record<string, { detected: string[]; allowUndefined: boolean }> = {
  pdf: { detected: ['pdf'], allowUndefined: false },
  png: { detected: ['png'], allowUndefined: false },
  jpg: { detected: ['jpg'], allowUndefined: false },
  jpeg: { detected: ['jpg'], allowUndefined: false },
  zip: { detected: ['zip'], allowUndefined: false },
  docx: { detected: ['docx', 'zip'], allowUndefined: false },
  xlsx: { detected: ['xlsx', 'zip'], allowUndefined: false },
  pptx: { detected: ['pptx', 'zip'], allowUndefined: false },
  doc: { detected: ['cfb', 'doc'], allowUndefined: false },
  xls: { detected: ['cfb', 'xls'], allowUndefined: false },
  ppt: { detected: ['cfb', 'ppt'], allowUndefined: false },
  txt: { detected: [], allowUndefined: true },
  md: { detected: [], allowUndefined: true },
};

export function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx < 0 || idx === filename.length - 1) return '';
  return filename.slice(idx + 1).toLowerCase();
}

export interface ValidatedUpload {
  ext: string;
  /** The canonical mime to persist (declared or the allowlist default). */
  mimeType: string;
}

/**
 * Full defense-in-depth validation of an uploaded file:
 *  1. Extension allowlist.
 *  2. Declared Content-Type must be consistent with the extension (or the
 *     generic octet-stream browsers sometimes send).
 *  3. Magic-byte sniffing of the real content must match the extension —
 *     defeating renamed executables and content spoofing.
 *
 * Throws a typed AppError on any mismatch. Pure and unit-testable.
 */
export async function validateUpload(params: {
  filename: string;
  declaredMime: string;
  buffer: Buffer;
}): Promise<ValidatedUpload> {
  const ext = extensionOf(params.filename);
  const allowedMimes = ALLOWED_EXTENSIONS[ext];
  if (!allowedMimes) {
    throw new AppError({ statusCode: 415, code: ErrorCode.FILE_TYPE_NOT_ALLOWED });
  }

  const declared = params.declaredMime.split(';')[0]!.trim().toLowerCase();
  const declaredOk =
    declared === 'application/octet-stream' || allowedMimes.includes(declared);
  if (!declaredOk) {
    throw new AppError({ statusCode: 415, code: ErrorCode.FILE_TYPE_NOT_ALLOWED });
  }

  const expected = EXPECTED_MAGIC[ext]!;
  const detected = await fileTypeFromBuffer(params.buffer);

  if (!detected) {
    if (!expected.allowUndefined) {
      throw new AppError({ statusCode: 415, code: ErrorCode.FILE_CONTENT_MISMATCH });
    }
    // Text formats: ensure the bytes are not actually binary (no NUL bytes).
    if (params.buffer.includes(0x00)) {
      throw new AppError({ statusCode: 415, code: ErrorCode.FILE_CONTENT_MISMATCH });
    }
  } else if (!expected.detected.includes(detected.ext)) {
    throw new AppError({ statusCode: 415, code: ErrorCode.FILE_CONTENT_MISMATCH });
  }

  return { ext, mimeType: allowedMimes[0]! };
}
