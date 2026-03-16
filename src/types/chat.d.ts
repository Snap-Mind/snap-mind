/** A file attached to a chat message (currently images only). */
export type Attachment = {
  /** Unique client-side id (crypto.randomUUID). */
  id: string;
  /** Attachment kind — extensible for future file types. */
  type: 'image';
  /** MIME type, e.g. "image/png", "image/jpeg", "image/webp", "image/gif". */
  mimeType: string;
  /** Base64-encoded file content (no data-URI prefix). */
  data: string;
  /** Original file name. */
  name: string;
  /** Original file size in bytes. */
  size: number;
};

export type SupportedImageType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

export type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** Optional image attachments (user messages only). */
  attachments?: Attachment[];
};
