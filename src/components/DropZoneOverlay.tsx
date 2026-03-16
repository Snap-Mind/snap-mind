/**
 * DropZoneOverlay — a wrapper that detects drag-over and renders a
 * full-screen translucent backdrop prompting the user to drop images.
 *
 * Usage:
 *   <DropZoneOverlay onDrop={addFiles} disabled={loading}>
 *     {children}
 *   </DropZoneOverlay>
 *
 * The overlay uses a counter-based approach to avoid flickering when
 * dragging over child elements (dragenter/dragleave fire for every child).
 */

import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { LuImage } from 'react-icons/lu';

interface DropZoneOverlayProps {
  /** Called with the dropped files. */
  onDrop: (files: FileList | File[]) => void;
  /** Disable drop interaction (e.g. while AI is responding). */
  disabled?: boolean;
  children: React.ReactNode;
}

export default function DropZoneOverlay({
  onDrop,
  disabled = false,
  children,
}: DropZoneOverlayProps) {
  const { t } = useTranslation();
  const [dragOver, setDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      dragCounterRef.current += 1;
      if (dragCounterRef.current === 1) setDragOver(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Required to allow drop
      if (!disabled) e.dataTransfer.dropEffect = 'copy';
    },
    [disabled]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setDragOver(false);
      if (disabled) return;
      if (e.dataTransfer.files?.length) {
        onDrop(e.dataTransfer.files);
      }
    },
    [disabled, onDrop]
  );

  return (
    <div
      className="relative w-full h-full"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* Full-screen translucent backdrop */}
      {dragOver && (
        <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none transition-opacity">
          <div className="flex flex-col items-center gap-3 text-white">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              <LuImage size={32} />
            </div>
            <span className="text-lg font-medium">{t('chat.dropImage')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
