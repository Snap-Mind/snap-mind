import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ErrorMessage from '../ErrorMessage';
import { Message } from '@/types/chat';

describe('ErrorMessage', () => {
  it('renders headline for role:error message', () => {
    const message: Message = {
      role: 'error',
      content: 'Failed to get response.',
      detail: 'API error: 401 Invalid API key',
    };
    render(<ErrorMessage message={message} />);
    expect(screen.getByText('Failed to get response.')).toBeInTheDocument();
  });

  it('keeps detail hidden until expanded', async () => {
    const user = userEvent.setup();
    const message: Message = {
      role: 'error',
      content: 'Failed to get response.',
      detail: 'API error: 401 Invalid API key',
    };
    render(<ErrorMessage message={message} />);

    expect(screen.queryByText(/API error: 401 Invalid API key/)).not.toBeInTheDocument();

    const trigger = screen.getByRole('button', { name: /Failed to get response/i });
    await user.click(trigger);

    expect(screen.getByText(/API error: 401 Invalid API key/)).toBeInTheDocument();
  });

  it('renders headline only when detail is missing', () => {
    const message: Message = {
      role: 'error',
      content: 'Failed to get response.',
    };
    render(<ErrorMessage message={message} />);
    expect(screen.getByText('Failed to get response.')).toBeInTheDocument();
    // No accordion button rendered when there's no detail to reveal.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
