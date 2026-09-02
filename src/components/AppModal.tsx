import type { ReactNode } from 'react';
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { useTranslation } from 'react-i18next';

export interface AppModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  /** Renders a default Cancel + Confirm footer when provided and `footer` is omitted. */
  onConfirm?: () => void | Promise<void>;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: 'primary' | 'danger' | 'default' | 'secondary' | 'success' | 'warning';
  confirmDisabled?: boolean;
  isConfirmLoading?: boolean;
  /** Replaces the default footer entirely. */
  footer?: ReactNode;
}

function AppModal({
  isOpen,
  onOpenChange,
  title,
  children,
  onConfirm,
  confirmLabel,
  cancelLabel,
  confirmColor = 'primary',
  confirmDisabled = false,
  isConfirmLoading = false,
  footer,
}: AppModalProps) {
  const { t } = useTranslation();

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center" backdrop="opaque">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">{title}</ModalHeader>
            <ModalBody>{children}</ModalBody>
            {footer ??
              (onConfirm != null ? (
                <ModalFooter>
                  <Button color="default" variant="light" onPress={onClose}>
                    {cancelLabel ?? t('common.cancel')}
                  </Button>
                  <Button
                    color={confirmColor}
                    isDisabled={confirmDisabled}
                    isLoading={isConfirmLoading}
                    onPress={() => void onConfirm()}
                  >
                    {confirmLabel ?? t('common.confirm')}
                  </Button>
                </ModalFooter>
              ) : null)}
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

export default AppModal;
