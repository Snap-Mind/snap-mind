import type { Message, ToolPart, SubRun, ToolPartState } from '@/types/chat';
import type {
  AiTokenEvent,
  AiDoneEvent,
  AiErrorEvent,
  AiToolCallEvent,
  AiApprovalRequestEvent,
  AiToolResultEvent,
} from '@/types/ai-ipc';

export type AiStreamEvent =
  | { kind: 'token'; e: AiTokenEvent }
  | { kind: 'done'; e: AiDoneEvent }
  | { kind: 'error'; e: AiErrorEvent }
  | { kind: 'tool-call'; e: AiToolCallEvent }
  | { kind: 'approval-request'; e: AiApprovalRequestEvent }
  | { kind: 'tool-result'; e: AiToolResultEvent };

function findPartWithSubRun(
  messages: Message[],
  toolCallId: string
): { msgIdx: number; partIdx: number } | null {
  for (let mi = messages.length - 1; mi >= 0; mi--) {
    const parts = messages[mi].parts;
    if (!parts) continue;
    for (let pi = 0; pi < parts.length; pi++) {
      if (parts[pi].toolCallId === toolCallId && parts[pi].subRun !== undefined) {
        return { msgIdx: mi, partIdx: pi };
      }
    }
  }
  return null;
}

function findPartByCallId(
  messages: Message[],
  toolCallId: string
): { msgIdx: number; partIdx: number } | null {
  for (let mi = messages.length - 1; mi >= 0; mi--) {
    const parts = messages[mi].parts;
    if (!parts) continue;
    for (let pi = 0; pi < parts.length; pi++) {
      if (parts[pi].toolCallId === toolCallId) {
        return { msgIdx: mi, partIdx: pi };
      }
    }
  }
  return null;
}

function updatePart(
  messages: Message[],
  msgIdx: number,
  partIdx: number,
  updater: (part: ToolPart) => ToolPart
): Message[] {
  const msgs = [...messages];
  const msg = msgs[msgIdx];
  const parts = [...(msg.parts ?? [])];
  parts[partIdx] = updater(parts[partIdx]);
  msgs[msgIdx] = { ...msg, parts };
  return msgs;
}

export function applyAiEvent(messages: Message[], rootRunId: string, ev: AiStreamEvent): Message[] {
  const { kind } = ev;
  const e = ev.e as any; // union discriminated by kind; cast to access fields generically

  // (a) Child path: parentRunId === rootRunId
  if (e.parentRunId === rootRunId) {
    // Child tool events are ignored in v1
    if (kind === 'tool-call' || kind === 'approval-request' || kind === 'tool-result') {
      return messages;
    }
    const loc = findPartWithSubRun(messages, e.parentToolCallId);
    if (!loc) return messages;

    if (kind === 'token') {
      return updatePart(messages, loc.msgIdx, loc.partIdx, (part) => {
        const subRun: SubRun = { ...part.subRun! };
        subRun.text += e.text;
        if (subRun.runId === '') subRun.runId = e.runId;
        return { ...part, subRun };
      });
    }
    if (kind === 'done') {
      return updatePart(messages, loc.msgIdx, loc.partIdx, (part) => {
        const subRun: SubRun = {
          ...part.subRun!,
          status: e.reason === 'aborted' ? 'aborted' : 'done',
        };
        return { ...part, subRun };
      });
    }
    if (kind === 'error') {
      return updatePart(messages, loc.msgIdx, loc.partIdx, (part) => {
        const subRun: SubRun = { ...part.subRun!, status: 'error', error: e.message };
        return { ...part, subRun };
      });
    }
    return messages;
  }

  // (b) Root tool path: parentRunId === null && runId === rootRunId
  if (e.parentRunId === null && e.runId === rootRunId) {
    // Root token/done/error stay on today's store paths — no change here
    if (kind === 'token' || kind === 'done' || kind === 'error') {
      return messages;
    }

    // Find the last assistant message
    let lastAssistantIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        lastAssistantIdx = i;
        break;
      }
    }
    if (lastAssistantIdx === -1) return messages;

    if (kind === 'tool-call') {
      const newPart: ToolPart = {
        type: 'tool',
        toolCallId: e.toolCallId,
        toolName: e.toolName,
        input: e.input,
        state: 'input-available',
      };
      if (
        e.toolName === 'invoke_agent' &&
        typeof (e.input as Record<string, unknown>)?.agentId === 'number'
      ) {
        const subRun: SubRun = {
          runId: '',
          agentId: (e.input as Record<string, unknown>).agentId as number,
          text: '',
          status: 'running',
        };
        newPart.subRun = subRun;
      }
      const msgs = [...messages];
      const msg = msgs[lastAssistantIdx];
      msgs[lastAssistantIdx] = { ...msg, parts: [...(msg.parts ?? []), newPart] };
      return msgs;
    }

    if (kind === 'approval-request') {
      const loc = findPartByCallId(messages, e.toolCallId);
      if (!loc) return messages;
      return updatePart(messages, loc.msgIdx, loc.partIdx, (part) => ({
        ...part,
        state: 'approval-requested' as const,
        requestId: e.requestId,
      }));
    }

    if (kind === 'tool-result') {
      const loc = findPartByCallId(messages, e.toolCallId);
      if (!loc) return messages;
      return updatePart(messages, loc.msgIdx, loc.partIdx, (part) => ({
        ...part,
        state: (e.isError ? 'output-error' : 'output-available') as ToolPartState,
        output: e.output,
      }));
    }

    return messages;
  }

  // (c) Anything else — stale run, return same reference
  return messages;
}
