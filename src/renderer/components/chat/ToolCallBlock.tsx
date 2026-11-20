import { useTranslation } from 'react-i18next';
import type { ToolPart } from '@/types/chat';
import Expand from '@/components/Expand';

interface Props {
  part: ToolPart;
}

export default function ToolCallBlock({ part }: Props) {
  const { t } = useTranslation();
  const title = t('chat.toolCall', { tool: part.toolName });

  const renderOutput = () => {
    if (part.state === 'output-error') {
      return <p className="text-danger">{String(part.output)}</p>;
    }
    if (part.state === 'output-available' && part.output !== undefined) {
      if (typeof part.output === 'string') {
        return <p>{part.output}</p>;
      }
      return (
        <pre className="whitespace-pre-wrap break-all">{JSON.stringify(part.output, null, 2)}</pre>
      );
    }
    return <p className="text-default-400">{t('chat.noProcessOutput')}</p>;
  };

  return (
    <Expand title={title} ariaLabel={title}>
      <div className="text-sm text-default-500">{renderOutput()}</div>
    </Expand>
  );
}
