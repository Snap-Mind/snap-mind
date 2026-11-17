import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

const mockRespondApproval = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal('window', {
  electronAPI: {
    aiRespondApproval: mockRespondApproval,
  },
});

import ToolApprovalCard from '../ToolApprovalCard';

const makePart = (overrides?: Partial<ToolPart>): ToolPart => ({
  type: 'tool',
  toolCallId: 'tc-1',
  toolName: 'my_tool',
  input: {},
  state: 'approval-requested',
  requestId: 'req-1',
  ...overrides,
});

describe('ToolApprovalCard', () => {
  beforeEach(() => {
    mockRespondApproval.mockClear();
  });

  it('Allow click sends approved true', () => {
    render(<ToolApprovalCard part={makePart()} />);
    fireEvent.click(screen.getByRole('button', { name: /chat\.toolAllow/i }));
    expect(mockRespondApproval).toHaveBeenCalledWith({ requestId: 'req-1', approved: true });
  });

  it('Deny click sends approved false', () => {
    render(<ToolApprovalCard part={makePart()} />);
    fireEvent.click(screen.getByRole('button', { name: /chat\.toolDeny/i }));
    expect(mockRespondApproval).toHaveBeenCalledWith({ requestId: 'req-1', approved: false });
  });

  it('buttons disable after a click', () => {
    render(<ToolApprovalCard part={makePart()} />);
    const allowBtn = screen.getByRole('button', { name: /chat\.toolAllow/i });
    fireEvent.click(allowBtn);
    expect(screen.getByRole('button', { name: /chat\.toolAllow/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /chat\.toolDeny/i })).toBeDisabled();
  });
});
