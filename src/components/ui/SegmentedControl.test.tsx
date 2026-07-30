/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl';

describe('SegmentedControl', () => {
  it('exposes the selected option and reports changes accessibly', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(
      <SegmentedControl
        ariaLabel="Quiz visibility"
        value="all"
        options={[
          { value: 'all', label: 'All' },
          { value: 'public', label: 'Public' },
          { value: 'private', label: 'Private' },
        ]}
        onChange={onChange}
      />,
    );

    const group = screen.getByRole('group', { name: 'Quiz visibility' });
    const selected = screen.getByRole('button', { name: 'All' });
    const inactive = screen.getByRole('button', { name: 'Public' });

    expect(group).toHaveClass('rounded-control', 'bg-control-surface', 'p-1');
    expect(selected).toHaveAttribute('aria-pressed', 'true');
    expect(selected).toHaveClass(
      'rounded-sm',
      'min-h-11',
      'text-sub',
      'bg-neutral-warm-white',
      'px-3.5',
      'font-semibold',
      'text-neutral-warm-8',
      'shadow-segmented',
    );
    expect(inactive).toHaveClass('px-2.5', 'font-normal', 'text-ink');

    await user.click(screen.getByRole('button', { name: 'Private' }));

    expect(onChange).toHaveBeenCalledWith('private');
    expect((await axe(container)).violations).toEqual([]);
  });
});
