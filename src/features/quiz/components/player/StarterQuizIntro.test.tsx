/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { StarterQuizIntro } from './StarterQuizIntro';

vi.mock('@/lib/analytics/client', () => ({ captureAnalyticsEvent: vi.fn() }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    onClick,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
      }}
    >
      {children}
    </a>
  ),
}));

function clearSkipCookie() {
  document.cookie = 'rk_starter_skipped=; Path=/; Max-Age=0';
}

describe('StarterQuizIntro (RIN-913)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSkipCookie();
  });
  afterEach(clearSkipCookie);

  it('shows the one-line intro and a Skip link to the dashboard with a 44px target', () => {
    render(<StarterQuizIntro quizSlug="fake-starter" />);

    expect(screen.getByRole('region', { name: 'starterIntroLabel' })).toBeInTheDocument();
    expect(screen.getByText('starterIntro')).toBeInTheDocument();
    const skip = screen.getByRole('link', { name: 'starterSkip' });
    expect(skip).toHaveAttribute('href', '/dashboard');
    expect(skip).toHaveClass('min-h-11');
  });

  it('sets the skip cookie and records starter_quiz_skipped with the slug only', () => {
    render(<StarterQuizIntro quizSlug="fake-starter" />);

    fireEvent.click(screen.getByRole('link', { name: 'starterSkip' }));

    expect(document.cookie).toContain('rk_starter_skipped=1');
    expect(captureAnalyticsEvent).toHaveBeenCalledExactlyOnceWith('starter_quiz_skipped', {
      quiz_slug: 'fake-starter',
    });
  });
});
