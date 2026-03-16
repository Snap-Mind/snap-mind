/**
 * AttachmentPreviewBar — renders a horizontal row of image thumbnails
 * with remove buttons.  Pure display component — no state of its own.
 *
 * Also shows a transient error message when provided.
 */

import type { Attachment } from '@/types/chat';
import AttachmentPreview from './AttachmentPreview';

interface AttachmentPreviewBarProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
  /** Optional error string shown below the previews. */
  errorMsg?: string | null;
}

export default function AttachmentPreviewBar({
  attachments,
  onRemove,
  errorMsg,
}: AttachmentPreviewBarProps) {
  if (attachments.length === 0 && !errorMsg) return null;

  return (
    <div className="px-1">
      {attachments.length > 0 && (
        <div className="flex flex-row gap-2 flex-wrap mb-1">
          {attachments.map((att) => (
            <AttachmentPreview key={att.id} attachment={att} onRemove={onRemove} />
          ))}
        </div>
      )}
      {errorMsg && <div className="text-danger text-xs px-0.5">{errorMsg}</div>}
    </div>
  );
}
