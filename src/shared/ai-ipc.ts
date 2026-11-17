import type { Message } from './chat';

export type AiSendErrorCode =
  | 'no-agent'
  | 'unbound'
  | 'missing-model'
  | 'no-api-key'
  | 'unknown_kind'
  | 'send_failed';

export type AiSendRequest = {
  agentId: number;
  messages: Message[];
};

export type AiSendResult =
  | { streamId: string }
  | { error: { code: AiSendErrorCode; message: string } };

export type AiTokenEvent = { streamId: string; text: string };
export type AiReasoningEvent = { streamId: string; text: string };
export type AiSourceEvent = {
  streamId: string;
  source: { url: string; title?: string };
};
export type AiDoneEvent = { streamId: string; reason: 'stop' | 'aborted' };
export type AiErrorEvent = { streamId: string; message: string };
