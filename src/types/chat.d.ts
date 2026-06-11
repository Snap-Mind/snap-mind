export type ChatSource = {
  url: string;
  title?: string;
};

export type TextContentPart = {
  type: 'text';
  text: string;
};

export type ImageContentPart = {
  type: 'image';
  data: string;
  mimeType: string;
};

export type ContentPart = TextContentPart | ImageContentPart;

export type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentPart[];
  sources?: ChatSource[];
};
