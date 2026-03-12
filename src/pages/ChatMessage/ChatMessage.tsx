import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Message } from '@/types/chat';

interface ChatMessageProps {
  message: Message;
}

/** Split content into thinking blocks and main content. */
function parseThinkingBlocks(content: string): {
  thinking: string;
  main: string;
  isThinking: boolean;
} {
  const thinkRegex = /<think>\n?([\s\S]*?)\n?<\/think>\n*/g;
  let thinking = '';
  let lastIndex = 0;
  let main = '';
  let match: RegExpExecArray | null;

  while ((match = thinkRegex.exec(content)) !== null) {
    main += content.slice(lastIndex, match.index);
    thinking += match[1];
    lastIndex = match.index + match[0].length;
  }
  main += content.slice(lastIndex);

  // Handle unclosed <think> block (streaming: </think> hasn't arrived yet)
  let isThinking = false;
  const unclosedIdx = main.indexOf('<think>');
  if (unclosedIdx !== -1) {
    const afterTag = main.slice(unclosedIdx + '<think>'.length).replace(/^\n/, '');
    thinking += afterTag;
    main = main.slice(0, unclosedIdx);
    isThinking = true;
  }

  return { thinking: thinking.trim(), main: main.trim(), isThinking };
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const { t } = useTranslation();
  const isUser = message.role === 'user';
  const [thinkingOpen, setThinkingOpen] = useState(false);

  const { thinking, main, isThinking } = useMemo(
    () =>
      isUser
        ? { thinking: '', main: message.content, isThinking: false }
        : parseThinkingBlocks(message.content),
    [message.content, isUser]
  );

  // While actively thinking (unclosed <think>), force the details open
  const detailsOpen = isThinking || thinkingOpen;

  // Define role-based style classes
  const bubbleBaseClasses = 'p-[10px_14px] text-base leading-normal break-words transition-colors';

  // Specific styles for each role
  const userBubbleClasses =
    'max-w-[80%] rounded-2xl shadow-sm bg-primary text-primary-foreground rounded-br-sm';
  const aiBubbleClasses = 'w-full markdown-body bg-background'; // Added markdown-body class for GitHub styling

  return (
    <div
      className={`flex flex-row mb-0.5 ${isUser ? 'justify-end' : 'justify-start'}`}
      aria-label={`${isUser ? 'User' : 'Assistant'} message`}
    >
      <div
        className={`relative ${bubbleBaseClasses} ${isUser ? userBubbleClasses : aiBubbleClasses}`}
      >
        {thinking && (
          <details
            open={detailsOpen}
            onToggle={(e) => {
              if (!isThinking) setThinkingOpen((e.target as HTMLDetailsElement).open);
            }}
            className="mb-3 rounded-lg border border-default-200 bg-default-50 overflow-hidden"
          >
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-default-500 hover:text-default-700 transition-colors">
              {isThinking ? '🧠 ' : '🧠 '}
              {t('chat.thinking', 'Thinking')}
              {isThinking && '...'}
            </summary>
            <div className="px-3 py-2 text-sm text-default-600 border-t border-default-200">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlight]}
              >
                {thinking}
              </ReactMarkdown>
            </div>
          </details>
        )}
        <ReactMarkdown
          remarkPlugins={[remarkGfm]} // Enables GitHub Flavored Markdown
          rehypePlugins={[
            rehypeRaw, // Enables raw HTML
            rehypeSanitize, // Sanitizes HTML to prevent XSS
            rehypeHighlight, // Syntax highlighting for code blocks
          ]}
        >
          {main}
        </ReactMarkdown>
      </div>
    </div>
  );
}
