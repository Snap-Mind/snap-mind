import type { Message } from './chat';

export type AiSendErrorCode =
  | 'no-agent'
  | 'unbound'
  | 'missing-model'
  | 'no-api-key'
  | 'unknown_kind'
  | 'send_failed';

export type AiRunRef = {
  runId: string;
  parentRunId: string | null;
  parentToolCallId: string | null;
};

export type AiSendRequest = {
  agentId: number;
  messages: Message[];
  loopEnabled: boolean;
};

export type AiSendResult =
  | { runId: string }
  | { error: { code: AiSendErrorCode; message: string } };

export type AiTokenEvent = AiRunRef & { text: string };
export type AiReasoningEvent = AiRunRef & { text: string };
export type AiSourceEvent = AiRunRef & { source: { url: string; title?: string } };
export type AiToolCallEvent = AiRunRef & {
  toolCallId: string;
  toolName: string;
  input: unknown;
};
export type AiApprovalRequestEvent = AiRunRef & {
  toolCallId: string;
  toolName: string;
  input: unknown;
  requestId: string;
};
export type AiToolResultEvent = AiRunRef & {
  toolCallId: string;
  toolName: string;
  output: unknown;
  isError: boolean;
};
export type AiDoneEvent = AiRunRef & { reason: 'stop' | 'aborted' };
export type AiErrorEvent = AiRunRef & { message: string };

export type AiApprovalResponse = {
  requestId: string;
  approved: boolean;
};
