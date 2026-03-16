/**
 * ImagePickerButton — a small icon button that opens the native file picker.
 *
 * It also renders the hidden <input type="file"> so the parent only needs
 * to pass refs/handlers from useImageAttachments.
 *
 * Designed to sit inline next to other toolbar buttons (e.g. ReasoningToggle).
 */

import { Button, Tooltip } from '@heroui/react';
import { LuPaperclip } from 'react-icons/lu';
import { useTranslation } from 'react-i18next';

interface ImagePickerButtonProps {
  /** Ref forwarded to the hidden file input. */
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  /** Accept string, e.g. "image/png,image/jpeg,image/webp,image/gif". */
  acceptTypes: string;
  /** Called when user selects files via the native picker. */
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Opens the native file picker. */
  onPress: () => void;
  /** Whether the user can still add more images. */
  canAddMore: boolean;
  /** Disable interaction entirely. */
  disabled?: boolean;
}

export default function ImagePickerButton({
  fileInputRef,
  acceptTypes,
  onFileInputChange,
  onPress,
  canAddMore,
  disabled = false,
}: ImagePickerButtonProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptTypes}
        multiple
        hidden
        onChange={onFileInputChange}
      />

      <Tooltip
        content={canAddMore ? t('chat.addImage') : t('chat.maxImagesReached')}
        placement="top"
      >
        <Button
          isIconOnly
          variant="light"
          size="sm"
          onPress={onPress}
          isDisabled={disabled || !canAddMore}
          aria-label={t('chat.addImage')}
        >
          <LuPaperclip size={18} />
        </Button>
      </Tooltip>
    </>
  );
}
