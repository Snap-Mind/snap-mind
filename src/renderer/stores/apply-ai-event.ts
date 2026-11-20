import type { Message, ToolPart, SubRun, ToolPartState } from '@/types/chat';
import type {
  AiTokenEvent,
  AiReasoningEvent,
  AiDoneEvent,
  AiErrorEvent,
  AiToolCallEvent,
  AiApprovalRequestEvent,
  AiToolResultEvent,
} from '@/types/ai-ipc';

export type AiStreamEvent =
  | { kind: 'token'; e: AiTokenEvent }
  | { kind: 'reasoning'; e: AiReasoningEvent }
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

function lastAssistantIndex(messages: Message[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') return i;
  }
  return -1;
}

function isProcessItem(msg: Message): boolean {
  return Boolean(msg.parts?.length);
}

function hasOpenThink(content: string): boolean {
  return content.lastIndexOf('<think>') > content.lastIndexOf('</think>');
}

function textOf(msg: Message): string {
  return typeof msg.content === 'string' ? msg.content : '';
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

function newSubRun(toolName: string, input: unknown): SubRun | undefined {
  if (toolName !== 'invoke_agent') return undefined;
  const agentId = (input as Record<string, unknown> | undefined)?.agentId;
  if (typeof agentId !== 'number') return undefined;
  return { runId: '', agentId, thinking: '', text: '', status: 'running' };
}

function newToolPart(
  toolCallId: string,
  toolName: string,
  input: unknown,
  state: ToolPartState
): ToolPart {
  const part: ToolPart = { type: 'tool', toolCallId, toolName, input, state };
  const subRun = newSubRun(toolName, input);
  if (subRun) part.subRun = subRun;
  return part;
}

function appendPart(messages: Message[], msgIdx: number, part: ToolPart): Message[] {
  const msgs = [...messages];
  const msg = msgs[msgIdx];
  msgs[msgIdx] = { ...msg, parts: [...(msg.parts ?? []), part] };
  return msgs;
}

function attachOrPushPart(messages: Message[], rootRunId: string, part: ToolPart): Message[] {
  const lastIdx = lastAssistantIndex(messages);
  if (lastIdx === -1) {
    return [...messages, { role: 'assistant', content: '', runId: rootRunId, parts: [part] }];
  }
  const last = messages[lastIdx];
  const emptyText = textOf(last).trim().length === 0;
  if (!isProcessItem(last) && !emptyText) {
    return [...messages, { role: 'assistant', content: '', runId: rootRunId, parts: [part] }];
  }
  return appendPart(messages, lastIdx, part);
}

function appendRootText(messages: Message[], rootRunId: string, text: string): Message[] {
  const last = messages.at(-1);
  if (last?.role === 'assistant' && !isProcessItem(last)) {
    const msgs = [...messages];
    msgs[msgs.length - 1] = {
      ...last,
      runId: last.runId ?? rootRunId,
      content: textOf(last) + text,
    };
    return msgs;
  }
  return [...messages, { role: 'assistant', content: text, runId: rootRunId }];
}

function closeOpenThinkOnLast(messages: Message[], rootRunId: string): Message[] {
  const last = messages.at(-1);
  if (last?.role === 'assistant' && !isProcessItem(last) && hasOpenThink(textOf(last))) {
    return appendRootText(messages, rootRunId, '</think>');
  }
  return messages;
}

function appendRootReasoning(messages: Message[], rootRunId: string, text: string): Message[] {
  const last = messages.at(-1);
  if (last?.role === 'assistant' && !isProcessItem(last)) {
    let content = textOf(last);
    if (!hasOpenThink(content)) content += '<think>';
    const msgs = [...messages];
    msgs[msgs.length - 1] = {
      ...last,
      runId: last.runId ?? rootRunId,
      content: content + text,
    };
    return msgs;
  }
  return [...messages, { role: 'assistant', content: `<think>${text}`, runId: rootRunId }];
}

/**
 * Called when the root run ends. Anything still in flight can no longer progress.
 */
export function settleRunningParts(messages: Message[]): Message[] {
  let changed = false;
  const next = messages.map((msg) => {
    const parts = msg.parts;
    if (!parts?.length) return msg;
    const nextParts = parts.map((part) => {
      const pendingApproval = part.state === 'approval-requested';
      const runningSubRun = part.subRun?.status === 'running';
      if (!pendingApproval && !runningSubRun) return part;
      changed = true;
      const nextPart: ToolPart = { ...part };
      if (pendingApproval) {
        nextPart.state = 'output-error';
        nextPart.output = 'Run ended before approval.';
      }
      if (runningSubRun) nextPart.subRun = { ...part.subRun!, status: 'aborted' };
      return nextPart;
    });
    if (nextParts === parts) return msg;
    return { ...msg, parts: nextParts };
  });
  return changed ? next : messages;
}

export function applyAiEvent(messages: Message[], rootRunId: string, ev: AiStreamEvent): Message[] {
  const { kind } = ev;
  const e = ev.e as {
    runId: string;
    parentRunId: string | null;
    parentToolCallId: string | null;
    text?: string;
    toolCallId?: string;
    toolName?: string;
    input?: unknown;
    requestId?: string;
    output?: unknown;
    isError?: boolean;
    reason?: 'stop' | 'aborted';
    message?: string;
  };

  if (e.parentRunId === rootRunId) {
    if (kind === 'tool-call' || kind === 'approval-request' || kind === 'tool-result') {
      return messages;
    }
    const loc = findPartWithSubRun(messages, e.parentToolCallId ?? '');
    if (!loc) return messages;

    if (kind === 'token') {
      return updatePart(messages, loc.msgIdx, loc.partIdx, (part) => {
        const subRun: SubRun = { ...part.subRun! };
        subRun.text += e.text ?? '';
        if (subRun.runId === '') subRun.runId = e.runId;
        return { ...part, subRun };
      });
    }
    if (kind === 'reasoning') {
      return updatePart(messages, loc.msgIdx, loc.partIdx, (part) => {
        const subRun: SubRun = { ...part.subRun! };
        subRun.thinking += e.text ?? '';
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

  if (e.parentRunId === null && e.runId === rootRunId) {
    if (kind === 'token') {
      const last = messages.at(-1);
      let next = messages;
      if (last?.role === 'assistant' && !isProcessItem(last) && hasOpenThink(textOf(last))) {
        next = appendRootText(messages, rootRunId, '</think>');
      }
      return appendRootText(next, rootRunId, e.text ?? '');
    }
    if (kind === 'reasoning') {
      return appendRootReasoning(messages, rootRunId, e.text ?? '');
    }
    if (kind === 'done' || kind === 'error') {
      const last = messages.at(-1);
      if (last?.role === 'assistant' && !isProcessItem(last) && hasOpenThink(textOf(last))) {
        return appendRootText(messages, rootRunId, '</think>');
      }
      return messages;
    }

    const loc = findPartByCallId(messages, e.toolCallId ?? '');

    if (kind === 'tool-call') {
      if (loc) {
        return updatePart(messages, loc.msgIdx, loc.partIdx, (part) => {
          const next: ToolPart = { ...part, toolName: e.toolName ?? part.toolName, input: e.input };
          if (!part.subRun) {
            const subRun = newSubRun(e.toolName ?? '', e.input);
            if (subRun && part.state === 'output-available') subRun.status = 'done';
            if (subRun && part.state === 'output-error') {
              subRun.status = 'error';
              subRun.error = String(part.output);
            }
            if (subRun) next.subRun = subRun;
          }
          return next;
        });
      }
      return attachOrPushPart(
        closeOpenThinkOnLast(messages, rootRunId),
        rootRunId,
        newToolPart(e.toolCallId ?? '', e.toolName ?? '', e.input, 'input-available')
      );
    }

    if (kind === 'approval-request') {
      if (!loc) {
        const part = newToolPart(
          e.toolCallId ?? '',
          e.toolName ?? '',
          e.input,
          'approval-requested'
        );
        part.requestId = e.requestId;
        return attachOrPushPart(closeOpenThinkOnLast(messages, rootRunId), rootRunId, part);
      }
      return updatePart(messages, loc.msgIdx, loc.partIdx, (part) => ({
        ...part,
        state: 'approval-requested' as const,
        requestId: e.requestId,
      }));
    }

    if (kind === 'tool-result') {
      const state: ToolPartState = e.isError ? 'output-error' : 'output-available';
      const settle = (part: ToolPart): ToolPart => {
        const next: ToolPart = { ...part, state, output: e.output };
        if (part.subRun?.status === 'running') {
          next.subRun = e.isError
            ? { ...part.subRun, status: 'error', error: String(e.output) }
            : { ...part.subRun, status: 'done' };
        }
        return next;
      };
      if (!loc) {
        return attachOrPushPart(
          closeOpenThinkOnLast(messages, rootRunId),
          rootRunId,
          settle(newToolPart(e.toolCallId ?? '', e.toolName ?? '', undefined, state))
        );
      }
      return updatePart(messages, loc.msgIdx, loc.partIdx, settle);
    }

    return messages;
  }

  return messages;
}
