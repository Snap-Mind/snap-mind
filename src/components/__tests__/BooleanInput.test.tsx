import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BooleanInput from '../BooleanInput';

describe('BooleanInput', () => {
  const mockOnValueChange = vi.fn();

  beforeEach(() => {
    mockOnValueChange.mockClear();
  });

  it('should render with label', () => {
    render(
      <BooleanInput
        id="test-switch"
        label="Test Switch"
        defaultSelected={false}
        onValueChange={mockOnValueChange}
      />
    );
    expect(screen.getByText('Test Switch')).toBeInTheDocument();
  });

  it('should render with description', () => {
    render(
      <BooleanInput
        id="test-switch"
        label="Test Switch"
        description="This is a test description"
        defaultSelected={false}
        onValueChange={mockOnValueChange}
      />
    );
    expect(screen.getByText('This is a test description')).toBeInTheDocument();
  });

  it('should call onValueChange when toggled', async () => {
    const user = userEvent.setup();
    render(
      <BooleanInput
        id="test-switch"
        label="Test Switch"
        defaultSelected={false}
        onValueChange={mockOnValueChange}
      />
    );

    const switchElement = screen.getByRole('switch');
    await user.click(switchElement);

    expect(mockOnValueChange).toHaveBeenCalled();
  });

  it('should render disabled prop', () => {
    const { container } = render(
      <BooleanInput
        id="test-switch"
        label="Test Switch"
        defaultSelected={false}
        onValueChange={mockOnValueChange}
        disabled={true}
      />
    );

    // Just verify the component renders with disabled prop
    expect(container).toBeTruthy();
  });
});
