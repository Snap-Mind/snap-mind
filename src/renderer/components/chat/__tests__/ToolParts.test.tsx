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

vi.stubGlobal('window', {
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
          text: 'Hello from worker',
          status: 'done',
        },
      },
    ];
    render(<ToolParts parts={parts} />);
    expect(screen.getByText('Worker Agent')).toBeInTheDocument();
    expect(screen.getByText('Hello from worker')).toBeInTheDocument();
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
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
