/** @vitest-environment jsdom */

import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('centres the selected tab in an overflowing bar and fades the side with hidden tabs', async () => {
    const user = userEvent.setup();
    const observers: Array<() => void> = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          observers.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    // A 200px bar over 600px of tabs; each tab is 200px wide at x = index * 200 - scrollLeft.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const index = options.findIndex((option) => option.tabId === this.id);
      if (index < 0) return { left: 0, width: 200 } as DOMRect;
      return { left: index * 200 - (this.parentElement?.scrollLeft ?? 0), width: 200 } as DOMRect;
    });
    const scrollTo = vi.fn();
    const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo');
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: scrollTo,
    });

    try {
      function StartsOnLastTab() {
        const [value, setValue] = useState<View>('history');
        return <TabBar ariaLabel="Views" options={options} value={value} onChange={setValue} />;
      }
      render(<StartsOnLastTab />);

      // Mount: jump (no animation) so a ?tab= deep link shows its selected tab.
      expect(scrollTo).toHaveBeenLastCalledWith({ left: 400, behavior: 'auto' });

      act(() => observers.forEach((callback) => callback()));
      expect(screen.getByTestId('tab-bar-fade-end')).toBeInTheDocument();
      expect(screen.queryByTestId('tab-bar-fade-start')).toBeNull();

      const list = screen.getByRole('tablist');
      Object.defineProperty(list, 'scrollLeft', { configurable: true, value: 400 });
      fireEvent.scroll(list);
      expect(screen.getByTestId('tab-bar-fade-start')).toBeInTheDocument();
      expect(screen.queryByTestId('tab-bar-fade-end')).toBeNull();

      await user.click(screen.getByRole('tab', { name: 'Overview' }));
      expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' });
    } finally {
      if (originalScrollTo)
        Object.defineProperty(HTMLElement.prototype, 'scrollTo', originalScrollTo);
      else Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo');
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });
});
