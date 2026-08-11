/** @vitest-environment jsdom */

import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { TabBar } from './TabBar';

type View = 'overview' | 'details' | 'history';

const options = [
  { value: 'overview', label: 'Overview', tabId: 'tab-overview', controlsId: 'panel' },
  { value: 'details', label: 'Details', tabId: 'tab-details', controlsId: 'panel' },
  { value: 'history', label: 'History', tabId: 'tab-history', controlsId: 'panel' },
] as const;

function Harness() {
  const [value, setValue] = useState<View>('overview');
  return <TabBar ariaLabel="Views" options={options} value={value} onChange={setValue} />;
}

describe('TabBar', () => {
  afterEach(cleanup);

  it('uses the primary orange action treatment only for the selected tab', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const overview = screen.getByRole('tab', { name: 'Overview' });
    const details = screen.getByRole('tab', { name: 'Details' });
    expect(overview).toHaveAttribute('aria-selected', 'true');
    expect(overview).toHaveClass('btn-primary');
    expect(details).toHaveClass('btn-ghost');

    await user.click(details);
    expect(details).toHaveAttribute('aria-selected', 'true');
    expect(details).toHaveClass('btn-primary');
    expect(overview).toHaveClass('btn-ghost');
  });

  it('owns arrow, Home and End navigation for every tab consumer', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const overview = screen.getByRole('tab', { name: 'Overview' });
    overview.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Details' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'History' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Home}');
    expect(overview).toHaveFocus();
    expect(overview).toHaveAttribute('aria-selected', 'true');
  });
});
