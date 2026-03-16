/**
 * ImageAttachmentService — client-side image reading, validation, and helpers.
 *
 * This module is UI-framework-agnostic so it can be consumed by React hooks,
 * plain event handlers, or tests.
 */

import type { Attachment } from '@/types/chat';

/** Supported image MIME types. */
export const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;

/** Maximum image file size in bytes (20 MB). */
export const MAX_IMAGE_SIZE = 20 * 1024 * 1024;

/** Maximum number of images per message. */
export const MAX_IMAGES_PER_MESSAGE = 5;

/** Result of attempting to read a file into an Attachment. */
export type ReadResult =
  | { ok: true; attachment: Attachment }
  | { ok: false; error: string; fileName: string };

/**
 * Read a single File into an Attachment object.
 * Returns an error string if the file is too large or not a supported type.
 */
export function readFileAsAttachment(file: File): Promise<ReadResult> {
  // Validate MIME type
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type as any)) {
    return Promise.resolve({
      ok: false,
      error: `Unsupported image type: ${file.type || 'unknown'}. Supported: ${SUPPORTED_IMAGE_TYPES.join(', ')}`,
      fileName: file.name,
    });
  }

  // Validate size
  if (file.size > MAX_IMAGE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return Promise.resolve({
      ok: false,
      error: `File "${file.name}" is too large (${sizeMB} MB). Max ${MAX_IMAGE_SIZE / (1024 * 1024)} MB.`,
      fileName: file.name,
    });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Strip the "data:<mime>;base64," prefix — we store raw base64
      const base64 = dataUrl.split(',')[1] ?? '';
      resolve({
        ok: true,
        attachment: {
          id: crypto.randomUUID(),
          type: 'image',
          mimeType: file.type,
          data: base64,
          name: file.name,
          size: file.size,
        },
      });
    };
    reader.onerror = () => {
      resolve({ ok: false, error: `Failed to read file "${file.name}"`, fileName: file.name });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Process multiple selected / dropped files.
 * Enforces MAX_IMAGES_PER_MESSAGE across *existing* + *new* images.
 */
export async function processFiles(
  files: FileList | File[],
  existingCount: number
): Promise<{ attachments: Attachment[]; errors: string[] }> {
  const fileArray = Array.from(files);
  const available = MAX_IMAGES_PER_MESSAGE - existingCount;

  const errors: string[] = [];
  if (fileArray.length > available) {
    errors.push(
      `Only ${available} more image(s) can be added (max ${MAX_IMAGES_PER_MESSAGE} per message). Extra files were ignored.`
    );
  }

  const toProcess = fileArray.slice(0, Math.max(0, available));
  const results = await Promise.all(toProcess.map(readFileAsAttachment));

  const attachments: Attachment[] = [];
  for (const r of results) {
    if (r.ok === true) {
      attachments.push(r.attachment);
    } else {
      errors.push(r.error);
    }
  }
  return { attachments, errors };
}

/**
 * Build a data-URI string from an Attachment, for rendering in <img> tags.
 */
export function toDataUri(att: Attachment): string {
  return `data:${att.mimeType};base64,${att.data}`;
}
