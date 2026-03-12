import { useMemo } from 'react';

export interface ParsedChatMessage {
  thinking: string;
  main: string;
  isThinking: boolean;
}

/** Split content into thinking blocks and main content. */
export function parseThinkingBlocks(content: string): ParsedChatMessage {
  const thinkRegex = /<think>\n?([\s\S]*?)\n?<\/think>\n*/g;
  const thinkingParts: string[] = [];
  let lastIndex = 0;
  let main = '';
  let match: RegExpExecArray | null;

  while ((match = thinkRegex.exec(content)) !== null) {
    main += content.slice(lastIndex, match.index);
    if (match[1]) {
      thinkingParts.push(match[1]);
    }
    lastIndex = match.index + match[0].length;
  }
  let thinking = thinkingParts.join('\n\n');
  main += content.slice(lastIndex);

  // Handle unclosed <think> block (streaming: </think> hasn't arrived yet)
  let isThinking = false;
  const unclosedIdx = main.indexOf('<think>');
  if (unclosedIdx !== -1) {
    const afterTag = main.slice(unclosedIdx + '<think>'.length).replace(/^\n/, '');
    thinking += (thinking && afterTag ? '\n\n' : '') + afterTag;
    main = main.slice(0, unclosedIdx);
    isThinking = true;
  }

  return { thinking: thinking.trim(), main: main.trim(), isThinking };
}

/**
 * Parse a chat message content string, splitting it into
 * thinking blocks (for reasoning models) and main content.
 */
export function useChatMessage(content: string, isUser: boolean): ParsedChatMessage {
  return useMemo(
    () =>
      isUser ? { thinking: '', main: content, isThinking: false } : parseThinkingBlocks(content),
    [content, isUser]
  );
}
