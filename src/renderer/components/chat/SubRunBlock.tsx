import { useTranslation } from 'react-i18next';
import { useAgentsStore } from '@/stores/useAgentsStore';
import type { ToolPart } from '@/types/chat';

interface Props {
  part: ToolPart;
}

export default function SubRunBlock({ part }: Props) {
  const { t } = useTranslation();
  const agents = useAgentsStore((s) => s.agents);
  const subRun = part.subRun!;

  const agent = agents.find((a) => a.id === subRun.agentId);
  const agentName = agent ? agent.name : `Agent #${subRun.agentId}`;

  const renderHeader = () => {
    switch (subRun.status) {
      case 'running':
        return <span>{t('chat.subRunRunning', { name: agentName })}</span>;
      case 'error':
        return (
          <span>
            {t('chat.subRunFailed', { name: agentName })}
            {subRun.error && <span className="ml-1 text-danger-600">{subRun.error}</span>}
          </span>
        );
      case 'aborted':
        return <span>{t('chat.subRunAborted', { name: agentName })}</span>;
      case 'done':
      default:
        return <span>{agentName}</span>;
    }
  };

  return (
    <div className="rounded-md border border-default-200 bg-default-50 px-3 py-2 text-xs">
      <div className="font-medium text-default-700 mb-1">{renderHeader()}</div>
      {subRun.text && <p className="text-default-600 whitespace-pre-wrap">{subRun.text}</p>}
    </div>
  );
}
