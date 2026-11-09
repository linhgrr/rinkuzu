import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { LandingCtaLink } from './LandingCtaLink';

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

  it('links to the locale-prefixed path without an intl provider (RIN-1370)', () => {
    render(
      <LandingCtaLink href="/try" cta="play_first" position="hero" locale="en">
        Play
      </LandingCtaLink>,
    );

    expect(screen.getByRole('link', { name: 'Play' })).toHaveAttribute('href', '/en/try');
  });

  it('keeps next-intl out of the static landing client graph (RIN-1370)', () => {
    const source = readFileSync(path.join(__dirname, 'LandingCtaLink.tsx'), 'utf8');

    expect(source).not.toMatch(/from '(?:@\/i18n\/navigation|next-intl[^']*)'/);
  });
});
