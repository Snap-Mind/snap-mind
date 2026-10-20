import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock('@/services/LoggerService', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import CopyMessageButton from '../CopyMessageButton';
import loggerService from '@/services/LoggerService';

describe('CopyMessageButton', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('returns null when text is empty', () => {
    const { container } = render(<CopyMessageButton text="   " />);
    expect(container).toBeEmptyDOMElement();
  });

  it('copies the provided text and shows copied state', async () => {
    render(<CopyMessageButton text="Hello **world**" />);

    const button = screen.getByRole('button', { name: /copy/i });
    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Hello **world**');
    expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.queryByRole('button', { name: /^Copied$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Copy$/i })).toBeInTheDocument();
  });

  it('keeps copy label when clipboard write fails', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('denied'));

    render(<CopyMessageButton text="Nope" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy/i }));
      await Promise.resolve();
    });

    expect(loggerService.warn).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copied/i })).not.toBeInTheDocument();
  });
});
