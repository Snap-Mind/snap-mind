import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ToolPart } from '@/types/chat';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => {
      if (opts) {
        return key.replace('{{tool}}', opts.tool ?? '').replace('{{name}}', opts.name ?? '');
      }
      return key;
    },
  }),
}));

vi.mock('@/services/logger-service', () => ({
  default: { warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/stores/useAgentsStore', () => ({
  useAgentsStore: (selector: (s: { agents: { id: number; name: string }[] }) => unknown) =>
    selector({ agents: [{ id: 7, name: 'Worker Agent' }] }),
}));

Object.assign(window, {
  electronAPI: {
    aiRespondApproval: vi.fn().mockResolvedValue({ ok: true }),
  },
});

import ToolParts from '../ToolParts';

describe('ToolParts', () => {
  it('renders SubRunBlock with worker name and streamed text', () => {
    const parts: ToolPart[] = [
      {
        type: 'tool',
        toolCallId: 'tc-sub',
        toolName: 'invoke_agent',
        input: {},
        state: 'output-available',
        subRun: {
          runId: 'run-1',
          agentId: 7,
          thinking: 'plan',
          text: 'Hello from worker',
          status: 'done',
        },
      },
    ];
    render(<ToolParts parts={parts} />);
    const thought = screen.getByRole('button', { name: 'chat.thought' });
    const subRun = screen.getByRole('button', { name: 'chat.subRunDone' });
    expect(thought.compareDocumentPosition(subRun) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(thought.contains(subRun)).toBe(false);
    expect(screen.queryByText('plan')).not.toBeInTheDocument();
    expect(screen.queryByText('Hello from worker')).not.toBeInTheDocument();
  });

  it('hides the sub-agent title until it has a reply', () => {
    const parts: ToolPart[] = [
      {
        type: 'tool',
        toolCallId: 'tc-sub',
        toolName: 'invoke_agent',
        input: {},
        state: 'input-available',
        subRun: {
          runId: 'run-1',
          agentId: 7,
          thinking: 'plan',
          text: '',
          status: 'running',
        },
      },
    ];
    render(<ToolParts parts={parts} />);
    expect(screen.getByRole('button', { name: 'chat.thinking...' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'chat.subRunRunning' })).not.toBeInTheDocument();
  });

  it('renders error text for output-error', () => {
    const parts: ToolPart[] = [
      {
        type: 'tool',
        toolCallId: 'tc-err',
        toolName: 'some_tool',
        input: {},
        state: 'output-error',
        output: 'Something went wrong',
      },
    ];
    render(<ToolParts parts={parts} />);
    expect(screen.getByRole('button', { name: 'chat.toolCall' })).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});
