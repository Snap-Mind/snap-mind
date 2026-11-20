import { useTranslation } from 'react-i18next';
import { useAgentsStore } from '@/stores/useAgentsStore';
import Expand from '@/components/Expand';
import ThinkingMessage from '@/components/ThinkingMessage';
import ChatMarkdown from '@/components/ChatMarkdown';
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

  const title = (() => {
    switch (subRun.status) {
      case 'running':
        return t('chat.subRunRunning', { name: agentName });
      case 'error':
        return t('chat.subRunFailed', { name: agentName });
      case 'aborted':
        return t('chat.subRunAborted', { name: agentName });
      case 'done':
      default:
        return t('chat.subRunDone', { name: agentName });
    }
  })();

  const hasReply = Boolean(subRun.text || subRun.error);

  return (
    <>
      {subRun.thinking ? (
        <ThinkingMessage
          thinking={subRun.thinking}
          isThinking={subRun.status === 'running' && !hasReply}
        />
      ) : null}
      {hasReply ? (
        <Expand title={title} ariaLabel={title}>
          {subRun.error && <p className="text-danger mb-1">{subRun.error}</p>}
          {subRun.text ? <ChatMarkdown text={subRun.text} muted /> : null}
        </Expand>
      ) : null}
    </>
  );
}
