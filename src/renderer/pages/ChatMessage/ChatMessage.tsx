import { Message, ImageContentPart } from '@/types/chat';
import ThinkingMessage from '@/components/ThinkingMessage';
import ChatMarkdown from '@/components/ChatMarkdown';
import ErrorMessage from '@/components/ErrorMessage';
import MessageWebSources from '@/components/MessageWebSources';
import MessageActions from '@/components/MessageActions';
import CopyMessageButton from '@/components/CopyMessageButton';
import ToolParts from '@/components/chat/ToolParts';
import AiLoadingIndicator from '@/components/chat/AiLoadingIndicator';
import { useChatMessage } from '@/hooks/useChatMessage';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

function MessageImages({ content }: { content: Message['content'] }) {
  if (typeof content === 'string') return null;
  const images = content.filter((p): p is ImageContentPart => p.type === 'image');
  if (images.length === 0) return null;
  return (
    <div className="flex flex-row flex-wrap gap-2 mb-1">
      {images.map((img, i) => (
        <img
          key={i}
          src={`data:${img.mimeType};base64,${img.data}`}
          alt="Attached image"
          className="max-w-[200px] max-h-[200px] rounded-lg object-cover"
        />
      ))}
    </div>
  );
}

export default function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const { thinking, main, isThinking } = useChatMessage(message.content, isUser);

  if (message.role === 'error') {
    return <ErrorMessage message={message} />;
  }

  // Define role-based style classes
  const bubbleBaseClasses = 'text-base leading-normal break-words transition-colors';

  // Specific styles for each role
  const userBubbleClasses =
    'p-[10px_14px] rounded-2xl shadow-sm bg-primary text-primary-foreground rounded-br-sm';
  const aiBubbleClasses = 'w-full bg-background px-[14px] py-0';

  const showActions =
    !isUser &&
    message.role === 'assistant' &&
    !isStreaming &&
    main.trim().length > 0 &&
    main !== '...';

  return (
    <div
      className={`flex flex-row ${isUser ? 'justify-end mb-2' : 'justify-start mb-0'}`}
      aria-label={`${isUser ? 'User' : 'Assistant'} message`}
    >
      <div className={`flex flex-col ${isUser ? 'max-w-[80%] items-end' : 'w-full'}`}>
        <div
          className={`relative ${bubbleBaseClasses} ${isUser ? userBubbleClasses : aiBubbleClasses}`}
        >
          {!isUser && (
            <ThinkingMessage thinking={thinking} isThinking={isThinking && isStreaming} />
          )}
          {!isUser && message.parts && message.parts.length > 0 && (
            <ToolParts parts={message.parts} />
          )}
          <MessageImages content={message.content} />
          {isStreaming && !main.trim() && !(message.parts && message.parts.length > 0) ? (
            <AiLoadingIndicator />
          ) : main.trim() ? (
            isUser ? (
              <div className="whitespace-pre-wrap">{main}</div>
            ) : (
              <ChatMarkdown text={main} />
            )
          ) : null}
          {!isUser && message.sources && message.sources.length > 0 && (
            <MessageWebSources sources={message.sources} />
          )}
        </div>
        {showActions && (
          <MessageActions>
            <CopyMessageButton text={main} />
          </MessageActions>
        )}
      </div>
    </div>
  );
}
