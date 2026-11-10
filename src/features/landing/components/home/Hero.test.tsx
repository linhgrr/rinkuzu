import type { AnchorHTMLAttributes, PropsWithChildren } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BottomCta from './BottomCta';
import Hero from './Hero';
import { captureAnalyticsEvent } from '@/lib/analytics/client';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
}));

vi.mock('@/lib/analytics/client', () => ({ captureAnalyticsEvent: vi.fn() }));

vi.mock('./Magnetic', () => ({
  Magnetic: ({ children }: PropsWithChildren) => <>{children}</>,
}));

describe('landing hero calls to action', () => {
  it('labels the guest registration route as starting learning, not as a demo', () => {
    render(<Hero locale="en" />);

    expect(screen.getByRole('link', { name: 'Start Learning' })).toHaveAttribute(
      'href',
      '/register?next=/adaptive',
    );
    expect(screen.queryByText('Try Demo')).not.toBeInTheDocument();
  });

  it('uses an authenticated learning label for the real adaptive route', () => {
    render(<Hero isAuthenticated locale="vi" />);

    expect(screen.getByRole('link', { name: 'Tiếp tục học' })).toHaveAttribute('href', '/adaptive');
    expect(screen.queryByText('Học thử')).not.toBeInTheDocument();
  });

  it.each([
    [
      'vi',
      'Làm thử quiz 2 phút, không cần tài khoản',
      'Thử với PDF của bạn – không cần tài khoản',
      'Tạo tài khoản',
    ],
    [
      'en',
      'Try a 2-minute quiz, no account',
      'Try it with your own PDF, no account needed',
      'Start Learning',
    ],
  ])(
    'leads the signed-out %s hero with play-first, then the guest PDF trial (RIN-1178, RIN-1473)',
    (locale, play, guestPdf, register) => {
      render(<Hero locale={locale} />);

      const links = screen.getAllByRole('link');
      expect(links.map((link) => link.textContent)).toEqual([play, guestPdf, register]);
      expect(links.map((link) => link.getAttribute('href'))).toEqual([
        '/try',
        '/try/pdf?entry=landing',
        '/register?next=/adaptive',
      ]);
      expect(links[0]).toHaveClass('bg-brand-action-strong');
      expect(links[1]).toHaveClass('border');
      expect(links[1]).not.toHaveClass('bg-brand-action-strong');
      expect(links[0]?.querySelector('.whitespace-nowrap')).toBeNull();
      expect(links[1]?.querySelector('img')).not.toBeNull();
    },
  );

  it('stacks the two signed-out pills at every width, the long PDF label at 16px (RIN-1473)', () => {
    render(<Hero locale="vi" />);

    const [play, guestPdf] = screen.getAllByRole('link');
    // Magnetic is a pass-through in this test, so the pills sit directly in their row.
    const row = play?.parentElement;
    expect(row).toBe(guestPdf?.parentElement);
    const rowClasses = row?.className.split(/\s+/) ?? [];
    expect(rowClasses).toEqual(expect.arrayContaining(['flex', 'flex-col', 'items-start']));
    expect(rowClasses.some((name) => name.endsWith(':flex-row'))).toBe(false);

    const label = guestPdf?.querySelector('span:last-child');
    const labelClasses = label?.className.split(/\s+/) ?? [];
    expect(labelClasses).toEqual(
      expect.arrayContaining(['text-balance', 'text-center', 'font-unbounded', 'text-[16px]']),
    );
    expect(labelClasses.some((name) => /^[a-z]+:text-\[\d+px\]$/.test(name))).toBe(false);
  });

  it('reports the guest PDF pill as its own landing CTA (RIN-1473)', async () => {
    render(<Hero locale="en" />);

    fireEvent.click(screen.getByRole('link', { name: /own PDF/ }));

    expect(captureAnalyticsEvent).toHaveBeenCalledWith(
      'landing_cta_clicked',
      expect.objectContaining({ cta: 'guest_pdf', position: 'hero', locale: 'en' }),
    );
  });

  it('keeps the signed-in hero unchanged', () => {
    render(<Hero isAuthenticated locale="en" />);

    const links = screen.getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Continue Learning', '/adaptive'],
      ['Upload PDF', '/adaptive/upload'],
    ]);
  });
});

/**
 * RIN-1295: a fixed 70px base clipped 'GENERATOR' to 'GENERATO' at 375 (scrollWidth 381 >
 * clientWidth 311). Below `sm` the size follows the viewport so the longest word fits; the
 * `sm`/`md`/`xl` sizes stay as they were.
 */
describe('landing hero title size (RIN-1295)', () => {
  it.each(['en', 'vi'])('scales the %s h1 with the viewport below sm', (locale) => {
    render(<Hero locale={locale} />);

    const classes = screen.getByRole('heading', { level: 1 }).className.split(/\s+/);
    expect(classes).toContain('text-[length:clamp(32px,calc(16vw_-_10px),70px)]');
    expect(classes).not.toContain('text-[70px]');
    expect(classes).toEqual(
      expect.arrayContaining([
        'sm:text-[90px]',
        'md:text-[120px]',
        'xl:text-[length:clamp(112px,calc(30vh_-_96px),144px)]',
        'min-[1800px]:text-[164px]',
      ]),
    );
    expect(classes.some((name) => /^break-|overflow-wrap/.test(name))).toBe(false);
  });
});

/**
 * RIN-1283: fonts use display: optional, so a late Vina Sans leaves the xl h1 in its wider
 * fallback (3 lines). With the fixed 254px gap and 144px title the play-first CTA sat at
 * y 835 on 1280x720. Below about 870px tall the gap and title now shrink with the viewport
 * height; taller screens keep 254px / 144px. Geometry is checked in critical-flows.spec.ts.
 */
describe('landing hero fits short desktop viewports (RIN-1283)', () => {
  it('scales the xl title gap and size with the viewport height, capped at the design values', () => {
    render(<Hero locale="en" />);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.className.split(/\s+/)).not.toContain('xl:text-[144px]');
    const titleBlock = heading.parentElement?.className.split(/\s+/) ?? [];
    expect(titleBlock).toContain('xl:mt-[clamp(104px,calc(100vh_-_616px),254px)]');
    expect(titleBlock).not.toContain('xl:mt-[254px]');
  });
});

describe('landing bottom calls to action (RIN-1178)', () => {
  it('offers the play-first starter quiz before upload to signed-out visitors', () => {
    render(<BottomCta locale="vi" />);

    const links = screen.getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Làm thử quiz 2 phút, không cần tài khoản', '/try'],
      ['Tải PDF lên', '/register?next=/adaptive/upload'],
    ]);
  });

  it('keeps the single upload button for signed-in visitors', () => {
    render(<BottomCta isAuthenticated locale="en" />);

    const links = screen.getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Upload PDF', '/adaptive/upload'],
    ]);
  });
});

/**
 * RIN-1286: white on the bright brand orange (#ff541b) is 3.21:1 and failed Lighthouse
 * color-contrast. A white CTA label needs the --brand-action-strong fill (5.18:1).
 */
describe('landing CTA label contrast (RIN-1286)', () => {
  const hasWhiteLabel = (link: HTMLElement) =>
    link.classList.contains('text-white') || link.querySelector('.text-white') !== null;

  it.each([
    ['guest hero', () => render(<Hero locale="en" />)],
    ['member hero', () => render(<Hero isAuthenticated locale="vi" />)],
    ['guest bottom', () => render(<BottomCta locale="en" />)],
    ['member bottom', () => render(<BottomCta isAuthenticated locale="vi" />)],
  ])('never pairs a white label with the bright orange fill in the %s CTAs', (_name, mount) => {
    mount();

    for (const link of screen.getAllByRole('link')) {
      if (hasWhiteLabel(link)) {
        expect(link.className.split(/\s+/)).not.toContain('bg-[#ff541b]');
      }
    }
  });

  it('gives the white-labelled bottom CTA its own strong fill on the orange section', () => {
    render(<BottomCta locale="en" />);

    const whiteLabelled = screen.getAllByRole('link').filter(hasWhiteLabel);
    expect(whiteLabelled.map((link) => link.textContent)).toEqual(['Upload PDF']);
    for (const link of whiteLabelled) {
      expect(link).toHaveClass('bg-brand-action-strong');
    }
  });
});
