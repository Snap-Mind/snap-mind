import { useState } from 'react';
import { Button } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import type { ToolPart } from '@/types/chat';

interface Props {
  part: ToolPart;
}

export default function ToolApprovalCard({ part }: Props) {
  const { t } = useTranslation();
  const [responded, setResponded] = useState(false);

  const handleApproval = (approved: boolean) => {
    if (responded) return;
    setResponded(true);
    window.electronAPI.aiRespondApproval({ requestId: part.requestId!, approved });
  };

  return (
    <div className="rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-xs flex flex-col gap-2">
      <p className="text-warning-700 font-medium">
        {t('chat.toolNeedsApproval', { tool: part.toolName })}
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          color="success"
          variant="flat"
          isDisabled={responded}
          onPress={() => handleApproval(true)}
        >
          {t('chat.toolAllow')}
        </Button>
        <Button
          size="sm"
          color="danger"
          variant="flat"
          isDisabled={responded}
          onPress={() => handleApproval(false)}
        >
          {t('chat.toolDeny')}
        </Button>
      </div>
    </div>
  );
}
