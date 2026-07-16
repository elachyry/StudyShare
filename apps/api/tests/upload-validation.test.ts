import { describe, expect, it } from 'vitest';
import { validateUpload, extensionOf } from '../src/lib/upload-validation.js';
import { AppError } from '../src/lib/errors.js';

// Minimal real magic-byte prefixes for each format.
const PDF = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n', 'latin1');
// Full 1x1 transparent PNG (valid signature + IHDR + IDAT + IEND).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
// Minimal but complete JPEG (SOI + APP0/JFIF + EOI).
const JPG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB/8AAEQgAAQABAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/aAAwDAQACEQMRAD8A/v4ooooA/9k=',
  'base64',
);
const ELF = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]); // Linux executable
const TXT = Buffer.from('Just some lecture notes.\nLine two.\n', 'utf8');

describe('extensionOf', () => {
  it('extracts and lowercases the extension', () => {
    expect(extensionOf('Notes.PDF')).toBe('pdf');
    expect(extensionOf('archive.tar.gz')).toBe('gz');
    expect(extensionOf('noext')).toBe('');
  });
});

describe('validateUpload', () => {
  it('accepts a real PDF with matching extension + mime', async () => {
    const res = await validateUpload({
      filename: 'lecture.pdf',
      declaredMime: 'application/pdf',
      buffer: PDF,
    });
    expect(res).toEqual({ ext: 'pdf', mimeType: 'application/pdf' });
  });

  it('accepts png/jpg by real content', async () => {
    await expect(
      validateUpload({ filename: 'a.png', declaredMime: 'image/png', buffer: PNG }),
    ).resolves.toMatchObject({ ext: 'png' });
    await expect(
      validateUpload({ filename: 'a.jpg', declaredMime: 'image/jpeg', buffer: JPG }),
    ).resolves.toMatchObject({ ext: 'jpg' });
  });

  it('accepts plain text (no magic signature)', async () => {
    await expect(
      validateUpload({ filename: 'notes.txt', declaredMime: 'text/plain', buffer: TXT }),
    ).resolves.toMatchObject({ ext: 'txt' });
  });

  it('rejects a disallowed extension', async () => {
    await expect(
      validateUpload({ filename: 'evil.exe', declaredMime: 'application/octet-stream', buffer: ELF }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('rejects a renamed executable (magic-byte mismatch)', async () => {
    // An ELF binary renamed to .pdf with a spoofed content-type.
    const err = await validateUpload({
      filename: 'malware.pdf',
      declaredMime: 'application/pdf',
      buffer: ELF,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('FILE_CONTENT_MISMATCH');
  });

  it('rejects binary content masquerading as .txt', async () => {
    const err = await validateUpload({
      filename: 'notes.txt',
      declaredMime: 'text/plain',
      buffer: ELF,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('FILE_CONTENT_MISMATCH');
  });

  it('rejects a declared mime inconsistent with the extension', async () => {
    const err = await validateUpload({
      filename: 'a.png',
      declaredMime: 'application/pdf',
      buffer: PNG,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('FILE_TYPE_NOT_ALLOWED');
  });
});
