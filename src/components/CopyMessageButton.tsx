import { useEffect, useState } from 'react';
import { Button } from '@heroui/react';
import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';
import loggerService from '@/services/LoggerService';

interface CopyMessageButtonProps {
  text: string;
}

const COPIED_RESET_MS = 1500;

export default function CopyMessageButton({ text }: CopyMessageButtonProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => window.clearTimeout(id);
  }, [copied]);

  if (!text.trim()) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (error) {
      loggerService.warn('[CopyMessageButton] Failed to copy message', error);
      setCopied(false);
    }
  };

  const label = copied ? t('chat.copied', 'Copied') : t('chat.copy', 'Copy');

  return (
    <Button
      isIconOnly
      variant="light"
      size="sm"
      onPress={handleCopy}
      aria-label={label}
      className="min-w-7 w-7 h-7 text-default-500 data-[hover=true]:text-foreground"
    >
      <Icon icon={copied ? 'circle-check-big' : 'copy'} size={16} />
    </Button>
  );
}
