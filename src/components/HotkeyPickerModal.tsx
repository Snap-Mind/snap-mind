import React, { useCallback, useEffect, useState } from 'react';
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Button } from '@heroui/react';
import HotkeyRecorder from './HotkeyRecorder';

/**
 * HotkeyPickerModal
 * A convenience modal wrapping `HotkeyRecorder`.
 *
 * Props:
 *  - isOpen: control visibility
 *  - initialValue?: existing hotkey string to show (NOT editable; user must re-record if they want change)
 *  - onCancel: invoked when user cancels/ closes without confirming
 *  - onConfirm: invoked with the new hotkey string when user confirms; only enabled when different from initial (if provided)
 *  - title?: optional custom title
 *
 * Behavior:
 *  - When opened, focuses the internal HotkeyRecorder automatically.
 *  - Confirm button disabled until a valid hotkey captured AND (no initialValue OR value !== initialValue).
 *  - Cancel / backdrop close triggers onCancel and discards captured value.
 *
 * Example:
 * ```tsx
 * const [hotkey, setHotkey] = useState<string | null>(null);
 * const [open, setOpen] = useState(false);
 *
 * <>
 *   <Button onPress={() => setOpen(true)}>Change Hotkey</Button>
 *   <HotkeyPickerModal
 *     isOpen={open}
 *     initialValue={hotkey}
 *     onCancel={() => setOpen(false)}
 *     onConfirm={(val) => { setHotkey(val); setOpen(false); }}
 *   />
 * </>
 * ```
 */
export interface HotkeyPickerModalProps {
  isOpen: boolean;
  initialValue?: string | null;
  onCancel: () => void;
  onConfirm: (val: string) => void;
  title?: string;
}

export const HotkeyPickerModal: React.FC<HotkeyPickerModalProps> = ({
  isOpen,
  initialValue = null,
  onCancel,
  onConfirm,
  title = 'Set Hotkey',
}) => {
  const [temp, setTemp] = useState<string | null>(null);
  // Reset only when opening fresh
  useEffect(() => {
    if (isOpen) setTemp(null);
  }, [isOpen]);

  const handleChange = useCallback((val: string | null) => {
    setTemp(val);
  }, []);

  const handleConfirm = () => {
    if (temp) onConfirm(temp);
  };

  const canConfirm = !!temp && (!initialValue || temp !== initialValue);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
      placement="center"
      backdrop="opaque"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader>{title}</ModalHeader>
            <ModalBody>
              {initialValue && (
                <div className="text-xs text-gray-500 mb-1">Current: <span className="font-mono">{initialValue}</span></div>
              )}
              <HotkeyRecorder autoFocus onChange={handleChange} />
              <div className="text-xs text-gray-400 mt-2">
                Press a combination: up to 2 modifiers + 1 key. Example: Command+Shift+K
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={() => { onCancel(); onClose(); }}>Cancel</Button>
              <Button color="primary" isDisabled={!canConfirm} onPress={() => { handleConfirm(); onClose(); }}>Confirm</Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default HotkeyPickerModal;
