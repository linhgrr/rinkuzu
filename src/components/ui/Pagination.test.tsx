/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations:
    (namespace: string) => (key: string, values?: Record<string, string | number>) =>
      values
        ? `${namespace}.${key}(${Object.entries(values)
            .map(([name, value]) => `${name}=${value}`)
            .join(',')})`
        : `${namespace}.${key}`,
}));

import Pagination from './Pagination';

describe('Pagination at phone width (RIN-977)', () => {
  afterEach(cleanup);

  it('collapses the page-number strip below sm and shows "page n of N" instead', () => {
    render(<Pagination currentPage={4} totalPages={12} onPageChange={vi.fn()} />);

    const indicator = screen.getByText('common.pageOf(page=4,totalPages=12)');
    expect(indicator).toHaveClass('sm:hidden');

    const pageFour = screen.getByRole('button', { name: '4' });
    const strip = pageFour.parentElement;
    expect(strip).toHaveClass('hidden', 'sm:flex');
    expect(pageFour).toHaveAttribute('aria-current', 'page');
  });

  it('wraps instead of overflowing and keeps prev/next at 40px', () => {
    render(<Pagination currentPage={1} totalPages={3} onPageChange={vi.fn()} />);

    const nav = screen.getByRole('navigation', { name: 'common.pagination' });
    expect(nav).toHaveClass('flex-wrap', 'gap-2');
    expect(nav.className).not.toMatch(/space-x-/);

    const prev = screen.getByRole('button', { name: 'common.previous' });
    const next = screen.getByRole('button', { name: 'common.next' });
    expect(prev).toBeDisabled();
    expect(prev).toHaveClass('h-10');
    expect(next).toHaveClass('h-10');
  });

  it('prev and next reach every page from the collapsed view', () => {
    const onPageChange = vi.fn();
    const { rerender } = render(
      <Pagination currentPage={12} totalPages={12} onPageChange={onPageChange} />,
    );

    expect(screen.getByRole('button', { name: 'common.next' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'common.previous' }));
    expect(onPageChange).toHaveBeenLastCalledWith(11);

    rerender(<Pagination currentPage={6} totalPages={12} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'common.next' }));
    expect(onPageChange).toHaveBeenLastCalledWith(7);
  });
});
