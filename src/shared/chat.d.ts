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

export type ToolPartState =
  | 'input-available'
  | 'approval-requested'
  | 'output-available'
  | 'output-error';
export type SubRun = {
  runId: string;
  agentId: number;
  thinking: string;
  text: string;
  status: 'running' | 'done' | 'aborted' | 'error';
  error?: string;
};
export type ToolPart = {
  type: 'tool';
  toolCallId: string;
  toolName: string;
  input: unknown;
  state: ToolPartState;
  requestId?: string;
  output?: unknown;
  subRun?: SubRun;
};

export type Message = {
  role: 'user' | 'assistant' | 'system' | 'error';
  content: string | ContentPart[];
  sources?: ChatSource[];
  detail?: string;
  runId?: string;
  parts?: ToolPart[];
};
