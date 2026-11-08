import type { AnchorHTMLAttributes, PropsWithChildren } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BottomCta from './BottomCta';
import Hero from './Hero';

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
    ['vi', 'Làm thử quiz 2 phút, không cần tài khoản', 'Tải PDF lên', 'Tạo tài khoản'],
    ['en', 'Try a 2-minute quiz, no account', 'Upload PDF', 'Start Learning'],
  ])(
    'leads the signed-out %s hero with the play-first starter quiz (RIN-1178)',
    (locale, play, upload, register) => {
      render(<Hero locale={locale} />);

      const links = screen.getAllByRole('link');
      expect(links.map((link) => link.textContent)).toEqual([play, upload, register]);
      expect(links.map((link) => link.getAttribute('href'))).toEqual([
        '/try',
        '/register?next=/adaptive/upload',
        '/register?next=/adaptive',
      ]);
      expect(links[0]).toHaveClass('bg-[#ff541b]');
      expect(links[1]).toHaveClass('border');
      expect(links[1]).not.toHaveClass('bg-[#ff541b]');
      expect(links[0]?.querySelector('.whitespace-nowrap')).toBeNull();
    },
  );

  it('keeps the signed-in hero unchanged', () => {
    render(<Hero isAuthenticated locale="en" />);

    const links = screen.getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Continue Learning', '/adaptive'],
      ['Upload PDF', '/adaptive/upload'],
    ]);
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
