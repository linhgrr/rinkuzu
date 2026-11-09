import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import BlogIndexPage, { generateMetadata as indexMetadata, revalidate } from './page';
import { generateMetadata as postMetadata } from './[slug]/page';
import { generateMetadata as authorMetadata } from './authors/[slug]/page';
import {
  GET,
  dynamicParams,
  generateStaticParams,
  revalidate as feedRevalidate,
} from './rss.xml/route';
import { canonicalFor } from '@/lib/seo';

// RIN-1330: each locale's blog has an RSS feed, linked from every blog page's <head>
// and visibly from the blog list.

vi.mock('next/image', () => ({ default: () => null }));
vi.mock('next-intl/server', () => import('../../../../../tests/helpers/blog-intl-mock'));

const AI_GUIDE = 'ai-powered-quiz-generation-guide';

const feedFor = async (locale: string): Promise<Response> =>
  GET(new Request(`https://example.test/${locale}/blog/rss.xml`), {
    params: Promise.resolve({ locale }),
  });

describe('blog RSS feed route', () => {
  it('is a static feed per locale, rebuilt on the blog pages cadence', () => {
    expect(generateStaticParams()).toEqual([{ locale: 'vi' }, { locale: 'en' }]);
    expect(dynamicParams).toBe(false);
    expect(feedRevalidate).toBe(revalidate);
  });

  it.each(['vi', 'en'])('serves RSS 2.0 of the /%s posts', async (locale) => {
    const response = await feedFor(locale);
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/rss+xml; charset=utf-8');
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain(`<link>${canonicalFor(locale, `/blog/${AI_GUIDE}`)}</link>`);
    expect(xml).not.toContain(`/${locale === 'vi' ? 'en' : 'vi'}/blog/`);
  });
});

describe('blog feed discovery', () => {
  const feedType = (locale: string) => ({
    'application/rss+xml': canonicalFor(locale, '/blog/rss.xml'),
  });

  it.each(['vi', 'en'])(
    'links the /%s feed from the list, post and author pages',
    async (locale) => {
      const metadata = [
        await indexMetadata({ params: Promise.resolve({ locale }) }),
        await postMetadata({ params: Promise.resolve({ locale, slug: AI_GUIDE }) }),
        await authorMetadata({ params: Promise.resolve({ locale, slug: 'rinkuzu-team' }) }),
      ];

      for (const page of metadata) {
        expect(page.alternates?.types).toEqual(feedType(locale));
      }
    },
  );

  it.each([
    { locale: 'vi', name: /Theo dõi qua RSS/ },
    { locale: 'en', name: /Subscribe via RSS/ },
  ])('shows a visible feed link on /$locale/blog', async ({ locale, name }) => {
    render(
      <NextIntlClientProvider locale={locale} messages={{}}>
        {await BlogIndexPage({ params: Promise.resolve({ locale }) })}
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole('link', { name })).toHaveAttribute('href', `/${locale}/blog/rss.xml`);
  });
});
