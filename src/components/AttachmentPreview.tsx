/**
 * AttachmentPreview — renders a single image attachment thumbnail
 * with a remove button overlay.
 */

import { Attachment } from '@/types/chat';
import { toDataUri } from '@/services/ImageAttachmentService';
import { LuX } from 'react-icons/lu';

interface AttachmentPreviewProps {
  attachment: Attachment;
  onRemove: (id: string) => void;
}

export default function AttachmentPreview({ attachment, onRemove }: AttachmentPreviewProps) {
  return (
    <div className="relative group w-16 h-16 rounded-lg overflow-hidden border border-default-200 flex-shrink-0">
      <img
        src={toDataUri(attachment)}
        alt={attachment.name}
        className="w-full h-full object-cover"
        draggable={false}
      />
      {/* Remove button — visible on hover */}
      <button
        type="button"
        onClick={() => onRemove(attachment.id)}
        className="absolute -top-0 -right-0 w-5 h-5 rounded-full bg-danger text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm cursor-pointer"
        aria-label={`Remove ${attachment.name}`}
      >
        <LuX size={12} />
      </button>
      {/* Subtle filename tooltip */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] leading-tight text-center truncate px-0.5 py-[1px]">
        {attachment.name}
      </div>
    </div>
  );
}
