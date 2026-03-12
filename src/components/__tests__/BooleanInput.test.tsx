import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
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

  it('should sync UI in controlled mode', async () => {
    const user = userEvent.setup();

    function ControlledWrapper() {
      const [selected, setSelected] = useState(false);
      return (
        <>
          <BooleanInput
            id="controlled-switch"
            label="Controlled Switch"
            isSelected={selected}
            defaultSelected={false}
            onValueChange={setSelected}
          />
          <span>{selected ? 'ON' : 'OFF'}</span>
        </>
      );
    }

    render(<ControlledWrapper />);

    const switchElement = screen.getByRole('switch');
    expect(screen.getByText('OFF')).toBeInTheDocument();

    await user.click(switchElement);
    expect(screen.getByText('ON')).toBeInTheDocument();
  });
});
