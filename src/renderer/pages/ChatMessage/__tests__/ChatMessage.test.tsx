import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: string | Record<string, string>) => {
      if (typeof opts === 'string') return opts;
      if (opts?.name) return key.replace('{{name}}', opts.name);
      if (opts?.tool) return key.replace('{{tool}}', opts.tool);
      return key;
    },
  }),
}));

vi.mock('@/components/LogoSvg', () => ({
  default: () => <span data-testid="snap-mind-logo" />,
}));

vi.mock('@/stores/useAgentsStore', () => ({
  useAgentsStore: (selector: (s: { agents: { id: number; name: string }[] }) => unknown) =>
    selector({ agents: [{ id: 7, name: 'Worker Agent' }] }),
}));

import ChatMessage from '../ChatMessage';

describe('ChatMessage actions', () => {
  it('shows copy action for finished assistant message', () => {
    render(<ChatMessage message={{ role: 'assistant', content: 'Hello' }} />);
    expect(screen.getByRole('toolbar', { name: /message actions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('keeps assistant rows tight vertically', () => {
    render(<ChatMessage message={{ role: 'assistant', content: 'Hello' }} />);
    const bubble = screen.getByLabelText('Assistant message').querySelector('.relative');
    expect(bubble).toHaveClass('py-0');
    expect(bubble).not.toHaveClass('p-[10px_14px]');
  });

  it('hides actions while streaming', () => {
    render(<ChatMessage message={{ role: 'assistant', content: 'partial' }} isStreaming />);
    expect(screen.queryByRole('toolbar', { name: /message actions/i })).not.toBeInTheDocument();
  });

  it('hides actions for user messages', () => {
    render(<ChatMessage message={{ role: 'user', content: 'Hi' }} />);
    expect(screen.queryByRole('toolbar', { name: /message actions/i })).not.toBeInTheDocument();
  });

  it('keeps user bubbles on the primary foreground color', () => {
    render(<ChatMessage message={{ role: 'user', content: 'Hi' }} />);
    const bubble = screen.getByText('Hi').closest('div.relative');
    expect(bubble).toHaveClass('text-primary-foreground');
    expect(screen.getByText('Hi').closest('.markdown-body')).toBeNull();
  });

  it('labels a leftover open think as Thought when not streaming', () => {
    render(<ChatMessage message={{ role: 'assistant', content: '<think>plan' }} />);
    expect(screen.getByRole('button', { name: 'Thought' })).toBeInTheDocument();
  });

  it('hides actions when main content is only thinking', () => {
    render(<ChatMessage message={{ role: 'assistant', content: '<think>\nsecret\n</think>\n' }} />);
    expect(screen.queryByRole('toolbar', { name: /message actions/i })).not.toBeInTheDocument();
  });

  it('shows the logo loading state while streaming empty content', () => {
    render(<ChatMessage message={{ role: 'assistant', content: '' }} isStreaming />);
    expect(screen.getByRole('status', { name: 'Generating' })).toBeInTheDocument();
  });

  it('renders tool process above the assistant text', () => {
    render(
      <ChatMessage
        message={{
          role: 'assistant',
          content: 'Final answer',
          parts: [
            {
              type: 'tool',
              toolCallId: 'tc-sub',
              toolName: 'invoke_agent',
              input: {},
              state: 'output-available',
              subRun: {
                runId: 'run-1',
                agentId: 7,
                thinking: '',
                text: 'Hello from worker',
                status: 'done',
              },
            },
          ],
        }}
      />
    );
    const process = screen.getByRole('button', { name: 'chat.subRunDone' });
    const answer = screen.getByText('Final answer');
    expect(process.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
