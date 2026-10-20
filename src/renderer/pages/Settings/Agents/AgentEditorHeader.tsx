import { Button } from '@heroui/react';
import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';

interface AgentEditorHeaderProps {
  title: string;
  onSave: () => void;
  onDelete?: () => void;
}

function AgentEditorHeader({ title, onSave, onDelete }: AgentEditorHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex shrink-0 items-start justify-between gap-3 pt-3">
      <h1 className="min-w-0 text-2xl font-bold">{title}</h1>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="solid"
          color="primary"
          onPress={onSave}
          startContent={<Icon icon="save" size={16} />}
        >
          {t('common.save')}
        </Button>
        {onDelete != null && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            color="danger"
            onPress={onDelete}
            startContent={<Icon icon="trash-2" size={16} />}
          >
            {t('common.delete')}
          </Button>
        )}
      </div>
    </div>
  );
}

export default AgentEditorHeader;
