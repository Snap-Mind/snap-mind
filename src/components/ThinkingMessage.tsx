import { Accordion, AccordionItem } from '@heroui/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import { useTranslation } from 'react-i18next';
import { LuLightbulb } from 'react-icons/lu';

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
    <Accordion
      className="mb-2 px-0"
    >
      <AccordionItem
        key="thinking"
        aria-label={title}
        title={
          <span className="text-sm font-medium text-default-500">
            {title}
          </span>
        }
        indicator={
          <LuLightbulb
            className={isThinking ? 'text-warning animate-pulse' : 'text-default-400'}
            size={16}
          />
        }
        classNames={{
          content: 'text-sm text-default-600 pt-0 pb-2',
        }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlight]}
        >
          {thinking}
        </ReactMarkdown>
      </AccordionItem>
    </Accordion>
  );
}
