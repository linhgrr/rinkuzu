/** @vitest-environment jsdom */

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { NavigationTabBar } from './NavigationTabBar';

const options = [
  { value: 'quizzes', label: 'Quizzes', href: '/my-quizzes' },
  { value: 'folders', label: 'Folders', href: '/my-quizzes?tab=folders' },
] as const;

describe('NavigationTabBar', () => {
  afterEach(cleanup);

  it('uses the same orange active treatment as interactive tabs while preserving links', () => {
    render(<NavigationTabBar ariaLabel="Library" options={options} value="folders" />);

    const quizzes = screen.getByRole('link', { name: 'Quizzes' });
    const folders = screen.getByRole('link', { name: 'Folders' });

    expect(quizzes).toHaveClass('btn-ghost');
    expect(folders).toHaveClass('btn-primary');
    expect(folders).toHaveAttribute('aria-current', 'page');
    expect(folders).toHaveAttribute('href', '/my-quizzes?tab=folders');
  });
});
