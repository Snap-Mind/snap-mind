import type { Message } from '../../../shared/chat.js';

export type ProviderConfig = {
  kind: string;
  apiKey: string | null;
  host: string;
  apiVersion: string | null;
};

export type ModelRef = { provider: ProviderConfig; modelId: string };

export type GenerationParams = {
  temperature: number;
  maxOutputTokens: number;
  topP: number;
  reasoning: boolean;
};

export type JsonSchema = Record<string, unknown>; // JSON Schema 7 object

export type ToolCall = { toolCallId: string; toolName: string; input: unknown };

export type RuntimeTool = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  execute(
    _input: unknown,
    _opts: { toolCallId: string; abortSignal: AbortSignal }
  ): Promise<unknown>;
};

export type StreamRequest = {
  model: ModelRef;
  params: GenerationParams;
  messages: Message[]; // app DTO; adapter maps
  instructions?: string;
  tools: RuntimeTool[]; // [] = one-shot
  maxSteps: number;
  abortSignal: AbortSignal;
  onApprove?: (_call: ToolCall) => Promise<'allow' | 'deny'>;
};

export type RunEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'reasoning-delta'; text: string }
  | { type: 'source'; url: string; title?: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; input: unknown }
  | {
      type: 'approval-request';
      toolCallId: string;
      toolName: string;
      input: unknown;
      requestId: string;
    }
  | { type: 'tool-result'; toolCallId: string; toolName: string; output: unknown; isError: boolean }
  | { type: 'done'; reason: 'stop' | 'aborted' }
  | { type: 'error'; message: string };

export type RunRef = { runId: string; parentRunId: string | null; parentToolCallId: string | null };
