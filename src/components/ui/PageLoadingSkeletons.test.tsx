import type { ComponentType } from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import * as skeletons from '@/components/ui/PageLoadingSkeletons';

const cases = Object.entries(skeletons) as [string, ComponentType<{ label: string }>][];

describe('page loading skeletons', () => {
  // Lighthouse aria-prohibited-attr on /en/profile (RIN-690): an aria-label on a
  // role-less div is ignored by screen readers, so the loading label was never announced.
  it.each(cases)('%s exposes its label through a status role', async (_name, Skeleton) => {
    const { container } = render(<Skeleton label="Loading..." />);

    expect(screen.getByRole('status', { name: 'Loading...' })).toHaveAttribute('aria-busy', 'true');
    expect((await axe(container)).violations).toEqual([]);
  });
});
