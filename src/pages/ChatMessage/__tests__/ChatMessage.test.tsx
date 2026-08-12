import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

import ChatMessage from '../ChatMessage';

describe('ChatMessage actions', () => {
  it('shows copy action for finished assistant message', () => {
    render(<ChatMessage message={{ role: 'assistant', content: 'Hello' }} />);
    expect(screen.getByRole('toolbar', { name: /message actions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('hides actions while streaming', () => {
    render(<ChatMessage message={{ role: 'assistant', content: 'partial' }} isStreaming />);
    expect(screen.queryByRole('toolbar', { name: /message actions/i })).not.toBeInTheDocument();
  });

  it('hides actions for user messages', () => {
    render(<ChatMessage message={{ role: 'user', content: 'Hi' }} />);
    expect(screen.queryByRole('toolbar', { name: /message actions/i })).not.toBeInTheDocument();
  });

  it('hides actions when main content is only thinking', () => {
    render(<ChatMessage message={{ role: 'assistant', content: '<think>\nsecret\n</think>\n' }} />);
    expect(screen.queryByRole('toolbar', { name: /message actions/i })).not.toBeInTheDocument();
  });
});
