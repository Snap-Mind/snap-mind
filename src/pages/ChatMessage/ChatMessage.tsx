import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';

import { Message } from '@/types/chat';
import ThinkingMessage from '@/components/ThinkingMessage';
import MessageWebSources from '@/components/MessageWebSources';
import { useChatMessage } from '@/hooks/useChatMessage';

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const { thinking, main, isThinking } = useChatMessage(message.content, isUser);

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
        {!isUser && <ThinkingMessage thinking={thinking} isThinking={isThinking} />}
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlight]}
        >
          {main}
        </ReactMarkdown>
        {!isUser && message.sources && message.sources.length > 0 && (
          <MessageWebSources sources={message.sources} />
        )}
      </div>
    </div>
  );
}
