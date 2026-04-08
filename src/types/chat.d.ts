export type ChatSource = {
  url: string;
  title?: string;
};

export type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: ChatSource[];
};
