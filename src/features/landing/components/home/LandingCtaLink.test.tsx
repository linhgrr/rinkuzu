import type { AnchorHTMLAttributes } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { LandingCtaLink } from './LandingCtaLink';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
}));
vi.mock('@/lib/analytics/client', () => ({ captureAnalyticsEvent: vi.fn() }));

describe('LandingCtaLink (RIN-1178)', () => {
  it('reports landing_cta_clicked with cta, position and locale only', () => {
    render(
      <LandingCtaLink href="/try" cta="play_first" position="bottom" locale="vi">
        Play
      </LandingCtaLink>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Play' }));

    expect(captureAnalyticsEvent).toHaveBeenCalledWith('landing_cta_clicked', {
      cta: 'play_first',
      position: 'bottom',
      locale: 'vi',
    });
  });
});
