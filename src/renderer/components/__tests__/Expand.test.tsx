import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Expand from '../Expand';

describe('Expand', () => {
  it('hides body until the title is clicked, then hides it again', async () => {
    const user = userEvent.setup();
    render(
      <Expand title="Thought">
        <p>secret</p>
      </Expand>
    );

    const trigger = screen.getByRole('button', { name: 'Thought' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('secret')).not.toBeInTheDocument();

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('secret')).toBeInTheDocument();

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('uses a pointer cursor on the title', () => {
    render(
      <Expand title="Thought">
        <p>secret</p>
      </Expand>
    );
    expect(screen.getByRole('button', { name: 'Thought' })).toHaveClass('cursor-pointer');
  });

  it('keeps the title and body on the secondary text scale', async () => {
    const user = userEvent.setup();
    render(
      <Expand title="Thought">
        <p>secret</p>
      </Expand>
    );

    const trigger = screen.getByRole('button', { name: 'Thought' });
    expect(trigger).toHaveClass('text-default-500');
    await user.click(trigger);
    expect(screen.getByText('secret').parentElement).toHaveClass('text-default-500');
  });
});
