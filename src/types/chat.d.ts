export type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning_content?: string;
};
