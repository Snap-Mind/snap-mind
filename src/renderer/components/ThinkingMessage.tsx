import { useTranslation } from 'react-i18next';
import Expand from '@/components/Expand';
import ChatMarkdown from '@/components/ChatMarkdown';

interface ThinkingMessageProps {
  /** The extracted thinking text to display. */
  thinking: string;
  /** Whether the model is still actively thinking (stream not finished). */
  isThinking: boolean;
}

export default function ThinkingMessage({ thinking, isThinking }: ThinkingMessageProps) {
  const { t } = useTranslation();

  if (!thinking) return null;

  const title = isThinking
    ? `${t('chat.thinking', 'Thinking')}...`
    : `${t('chat.thought', 'Thought')}`;

  return (
    <Expand title={title}>
      <ChatMarkdown text={thinking} muted />
    </Expand>
  );
}
