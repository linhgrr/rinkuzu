/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import ReviewCard from './ReviewCard';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('react-hotkeys-hook', () => ({
  useHotkeys: vi.fn(),
}));

describe('ReviewCard', () => {
  it('renders Markdown on both card faces without losing heading semantics', async () => {
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

    expect(screen.getByText('now')).toHaveProperty('tagName', 'STRONG');
    expect(container.querySelector('h3')).toBeInTheDocument();
    fireEvent.click(screen.getByText('tapToSeeAnswer'));
    expect(container.querySelectorAll('[data-rich-text="option"]')).toHaveLength(2);
    expect(container.querySelectorAll('.katex')).toHaveLength(3);
    expect((await axe(container)).violations).toEqual([]);
  });
});
