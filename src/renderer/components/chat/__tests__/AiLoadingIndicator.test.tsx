import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock('@/components/LogoSvg', () => ({
  default: ({ className }: { className?: string }) => (
    <span data-testid="snap-mind-logo" className={className} />
  ),
}));

import AiLoadingIndicator from '../AiLoadingIndicator';

describe('AiLoadingIndicator', () => {
  it('exposes a generating status and the logo', () => {
    render(<AiLoadingIndicator />);
    expect(screen.getByRole('status', { name: 'Generating' })).toBeInTheDocument();
    expect(screen.getByTestId('snap-mind-logo')).toBeInTheDocument();
  });
});
