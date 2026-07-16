/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl';

describe('SegmentedControl', () => {
  it('exposes the selected option and reports changes accessibly', async () => {
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

    expect(screen.getByRole('group', { name: 'Quiz visibility' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Private' }));

    expect(onChange).toHaveBeenCalledWith('private');
    expect((await axe(container)).violations).toEqual([]);
  });
});
