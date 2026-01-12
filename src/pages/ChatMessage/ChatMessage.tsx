import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';

import { Message } from '@/types/chat';

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

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
        {!isUser && message.reasoning_content && (
          <div className="mb-2">
            <details className="text-sm bg-gray-50 dark:bg-zinc-900/50 rounded-lg border border-gray-200 dark:border-zinc-800">
              <summary className="cursor-pointer px-3 py-2 text-gray-500 dark:text-gray-400 font-medium hover:text-gray-700 dark:hover:text-gray-300 select-none flex items-center gap-2">
                <span>💭 Reasoning Process</span>
              </summary>
              <div className="px-3 pb-3 pt-1 text-gray-600 dark:text-gray-300 font-mono text-xs whitespace-pre-wrap">
                {message.reasoning_content}
              </div>
            </details>
          </div>
        )}
        <ReactMarkdown
          remarkPlugins={[remarkGfm]} // Enables GitHub Flavored Markdown
          rehypePlugins={[
            rehypeRaw, // Enables raw HTML
            rehypeSanitize, // Sanitizes HTML to prevent XSS
            rehypeHighlight, // Syntax highlighting for code blocks
          ]}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
