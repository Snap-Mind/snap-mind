import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChatMarkdown from '../ChatMarkdown';

describe('ChatMarkdown', () => {
  it('uses the default text scale when muted', () => {
    const { container } = render(<ChatMarkdown text="Hello from worker" muted />);
    expect(container.firstChild).toHaveClass('text-default-500');
    expect(screen.getByText('Hello from worker')).toBeInTheDocument();
  });

  it('does not mute the main answer', () => {
    const { container } = render(<ChatMarkdown text="Final answer" />);
    expect(container.firstChild).not.toHaveClass('text-default-500');
  });
});
