/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import ReviewCard from './ReviewCard';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('react-hotkeys-hook', () => ({
  useHotkeys: vi.fn(),
}));

// KaTeX loads on demand (RIN-679); its first import is a cold transform in vitest.
const KATEX_LOAD = { timeout: 10_000 };

describe('ReviewCard', () => {
  it('renders Markdown on both card faces without losing heading semantics', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ReviewCard
        question={{
          text: 'Solve **now**: $x^2 = 4$',
          options: ['$x = 2$', '$x = -2$'],
          correctIndexes: [0, 1],
        }}
        onResult={vi.fn()}
      />,
    );
    await waitFor(() => expect(container.querySelector('.katex')).not.toBeNull(), KATEX_LOAD);

    expect(screen.getByText('now')).toHaveProperty('tagName', 'STRONG');
    expect(container.querySelector('h3')).toBeInTheDocument();
    await user.click(screen.getByText('tapToSeeAnswer'));
    expect(container.querySelectorAll('[data-rich-text="option"]')).toHaveLength(2);
    expect(container.querySelectorAll('.katex')).toHaveLength(3);
    expect((await axe(container)).violations).toEqual([]);
  });
});
