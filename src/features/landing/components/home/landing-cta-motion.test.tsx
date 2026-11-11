import type { AnchorHTMLAttributes } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BottomCta from './BottomCta';
import Hero from './Hero';

// RIN-1552: the Founder found the landing button motion ugly. Hero and bottom CTAs change
// colour on hover and show a focus ring; nothing moves or scales on hover or press.

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
}));

vi.mock('@/lib/analytics/client', () => ({ captureAnalyticsEvent: vi.fn() }));

const MOTION_CLASS = /(^|:)(-?scale-|-?translate-|transition-\[[^\]]*transform|transition-all)/;

function motionClasses(element: Element): string[] {
  return element.className
    .toString()
    .split(/\s+/)
    .filter((name) => MOTION_CLASS.test(name));
}

const cases = [
  ['hero, signed out', () => <Hero locale="en" />],
  ['hero, signed in', () => <Hero isAuthenticated locale="en" />],
  ['bottom, signed out', () => <BottomCta locale="en" />],
  ['bottom, signed in', () => <BottomCta isAuthenticated locale="en" />],
] as const;

describe('landing CTA motion (RIN-1552)', () => {
  it.each(cases)('%s: no button or wrapper moves on hover or press', (_label, renderCtas) => {
    const { container } = render(renderCtas());
    const pills = Array.from(container.querySelectorAll('a')).filter((link) =>
      link.className.includes('rounded-[100px]'),
    );
    expect(pills.length).toBeGreaterThan(0);

    for (const pill of pills) {
      expect(motionClasses(pill)).toEqual([]);
      expect(pill.className).toContain('transition-colors');
      expect(pill.className).toContain('focus-visible:ring-2');

      fireEvent.pointerMove(pill, { pointerType: 'mouse', clientX: 400, clientY: 400 });
      for (let node: Element | null = pill; node && node !== container; node = node.parentElement) {
        expect((node as HTMLElement).style.transform).toBe('');
        expect(motionClasses(node)).toEqual([]);
      }
    }
  });
});
