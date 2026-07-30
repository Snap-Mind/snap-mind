import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import MessageActions from '../MessageActions';

describe('MessageActions', () => {
  it('renders children inside a toolbar', () => {
    render(
      <MessageActions>
        <button type="button">Copy</button>
        <button type="button">Other</button>
      </MessageActions>
    );

    expect(screen.getByRole('toolbar', { name: /message actions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Other' })).toBeInTheDocument();
  });
});
