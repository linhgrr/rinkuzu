/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { ErrorState } from './ErrorState';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => (key === 'retry' ? 'Retry' : key),
}));

describe('ErrorState', () => {
  it('announces the error and preserves the retry action', async () => {
    const onRetry = vi.fn();
    const { container } = render(<ErrorState message="Could not load" onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load');
    screen.getByRole('button', { name: 'Retry' }).click();
    expect(onRetry).toHaveBeenCalledOnce();
    expect((await axe(container)).violations).toEqual([]);
  });

  it('renders a custom action when retry is absent', () => {
    render(
      <ErrorState message="Could not load" action={<button type="button">Get help</button>} />,
    );
    expect(screen.getByRole('button', { name: 'Get help' })).toBeInTheDocument();
  });
});
