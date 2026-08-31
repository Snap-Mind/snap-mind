import { Button } from '@heroui/react';

import Icon from '@/components/Icon';

interface AgentEditorHeaderProps {
  title: string;
  saveLabel: string;
  onSave: () => void;
  deleteLabel?: string;
  onDelete?: () => void;
}

function AgentEditorHeader({
  title,
  saveLabel,
  onSave,
  deleteLabel,
  onDelete,
}: AgentEditorHeaderProps) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-3 pt-3">
      <h1 className="min-w-0 text-2xl font-bold">{title}</h1>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          isIconOnly
          size="sm"
          variant="light"
          color="primary"
          onPress={onSave}
          aria-label={saveLabel}
        >
          <Icon icon="save" size={16} />
        </Button>
        {onDelete != null && deleteLabel != null && (
          <Button
            type="button"
            isIconOnly
            size="sm"
            variant="light"
            color="danger"
            onPress={onDelete}
            aria-label={deleteLabel}
          >
            <Icon icon="trash-2" size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}

export default AgentEditorHeader;
