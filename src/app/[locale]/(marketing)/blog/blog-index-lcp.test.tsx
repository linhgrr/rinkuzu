import type { ComponentProps } from 'react';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { locales } from '@/i18n/config';
import BlogIndexPage from './page';

// RIN-683: the first card's thumbnail is the LCP element on /blog, so it must load eagerly
// with high fetch priority; the cards below the fold stay lazy.

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/blog',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
}));

// The real next/image decides loading/fetchpriority; unoptimized skips the remote-host
// check that needs next.config.
vi.mock('next/image', async (importOriginal) => {
  const { default: RealImage } = await importOriginal<typeof import('next/image')>();
  return {
    default: (props: ComponentProps<typeof RealImage>) => <RealImage {...props} unoptimized />,
  };
});

describe.each(locales)('blog index on /%s', (locale) => {
  it('loads only the first thumbnail eagerly', async () => {
    const { container } = render(
      <NextIntlClientProvider locale={locale} messages={{}}>
        {await BlogIndexPage({ params: Promise.resolve({ locale }) })}
      </NextIntlClientProvider>,
    );
    const images = Array.from(container.querySelectorAll('img'));

    expect(images.length).toBeGreaterThan(1);
    const [first, ...rest] = images;
    expect(first?.getAttribute('loading')).not.toBe('lazy');
    expect(first?.getAttribute('fetchpriority')).toBe('high');
    for (const image of rest) {
      expect(image.getAttribute('loading')).toBe('lazy');
      expect(image.getAttribute('fetchpriority')).not.toBe('high');
    }
  });
});
