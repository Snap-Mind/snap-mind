/**
 * useImageAttachments — reusable hook that manages image attachment state,
 * file validation, and error messages.
 *
 * This hook is UI-agnostic: it exposes primitives that any component can
 * wire into buttons, drag-drop zones, paste handlers, etc.
 */

import { useState, useCallback, useRef } from 'react';
import type { Attachment } from '@/types/chat';
import {
  SUPPORTED_IMAGE_TYPES,
  MAX_IMAGES_PER_MESSAGE,
  processFiles,
} from '@/services/ImageAttachmentService';

export interface UseImageAttachmentsReturn {
  /** Current list of pending attachments. */
  attachments: Attachment[];
  /** Replace the full attachment list (e.g. to clear on send). */
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  /** Process new File objects (from picker, drop, or paste). */
  addFiles: (files: FileList | File[]) => Promise<void>;
  /** Remove a single attachment by id. */
  removeAttachment: (id: string) => void;
  /** Whether more images can still be added. */
  canAddMore: boolean;
  /** Transient error message (auto-clears after 5 s). null when none. */
  errorMsg: string | null;
  /** Whether interaction is disabled. */
  disabled: boolean;
  /** Ref to the hidden file <input> — pass to ImagePickerButton. */
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  /** onChange handler for the hidden file <input>. */
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Open the native file picker programmatically. */
  openFilePicker: () => void;
  /** Accept string for <input accept="...">. */
  acceptTypes: string;
  /** Handle paste events — extracts images from clipboard. */
  handlePaste: (e: React.ClipboardEvent) => void;
}

export function useImageAttachments(disabled = false): UseImageAttachmentsReturn {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const acceptTypes = SUPPORTED_IMAGE_TYPES.join(',');

  const showError = useCallback((msg: string) => {
    setErrorMsg(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setErrorMsg(null), 5000);
  }, []);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      if (disabled) return;
      const { attachments: newAtts, errors } = await processFiles(files, attachments.length);
      if (errors.length) showError(errors.join(' '));
      if (newAtts.length) setAttachments((prev) => [...prev, ...newAtts]);
    },
    [attachments.length, disabled, showError]
  );

  const removeAttachment = useCallback(
    (id: string) => {
      if (disabled) return;
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    },
    [disabled]
  );

  const openFilePicker = useCallback(() => {
    if (disabled) return;
    fileInputRef.current?.click();
  }, [disabled]);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        addFiles(e.target.files);
        e.target.value = '';
      }
    },
    [addFiles]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (disabled) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length) {
        e.preventDefault();
        addFiles(imageFiles);
      }
    },
    [addFiles, disabled]
  );

  const canAddMore = attachments.length < MAX_IMAGES_PER_MESSAGE;

  return {
    attachments,
    setAttachments,
    addFiles,
    removeAttachment,
    canAddMore,
    errorMsg,
    disabled,
    fileInputRef,
    handleFileInputChange,
    openFilePicker,
    acceptTypes,
    handlePaste,
  };
}
