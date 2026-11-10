import { render, screen, within } from '@testing-library/react';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { isValidElement, Suspense, type ReactElement, type ReactNode } from 'react';
import { createTranslator, NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { getQuizTopicHubService } from '@/lib/quiz-topic-hub-factory';
import viExplore from '../../../../../messages/vi/explore.json';

type HubService = ReturnType<typeof getQuizTopicHubService>;
type QuizTopicHubSummaryDto = Awaited<ReturnType<HubService['listIndexableTopics']>>[number];

// RIN-1249 B6: `/vi/explore` links the indexable hubs; nothing in `/en` or
// without hubs, and a failed read leaves the page as it was. Fake topics.

const { listIndexableTopics, loggerError } = vi.hoisted(() => ({
  listIndexableTopics: vi.fn<() => Promise<QuizTopicHubSummaryDto[]>>(),
  loggerError: vi.fn(),
}));

vi.mock('@/lib/quiz-topic-hub-factory', () => ({
  getQuizTopicHubService: () => ({ listIndexableTopics }),
}));
vi.mock('@/lib/logger', () => ({ logger: { error: loggerError } }));
vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale }: { locale: string }) =>
    createTranslator({ locale, messages: { explore: viExplore }, namespace: 'explore.hub' }),
}));
vi.mock('@/features/explore/components/ExplorePageClient', () => ({
  ExplorePageClient: ({ hubLinks }: { hubLinks?: ReactNode }) => (
    <main>
      <h1>Khám phá</h1>
      {hubLinks}
    </main>
  ),
}));

import ExplorePage from './page';
import { ExploreTopicHubLinks } from './TopicHubLinks';

function summary(index: number): QuizTopicHubSummaryDto {
  return {
    slug: `mon-${index}`,
    locale: 'vi',
    name: `Môn ${index}`,
    indexableQuizCount: 3,
    lastModified: '2026-11-01T00:00:00.000Z',
  };
}

type PageElement = ReactElement<{ hubLinks?: ReactNode }>;

async function explorePage(locale: string): Promise<PageElement> {
  return (await ExplorePage({ params: Promise.resolve({ locale }) })) as PageElement;
}

/** Resolves the streamed hub boundary the way the server does, then renders the page. */
async function renderExplore(locale: string) {
  const page = await explorePage(locale);
  const boundary = page.props.hubLinks;
  let hubLinks: ReactNode = null;
  if (isValidElement<{ children: ReactElement<{ locale: string }> }>(boundary)) {
    hubLinks = await ExploreTopicHubLinks(boundary.props.children.props);
  }
  return render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {{ ...page, props: { ...page.props, hubLinks } }}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  listIndexableTopics.mockReset();
  loggerError.mockReset();
});

describe('/explore topic hub links (B6)', () => {
  it('links at most 12 indexable hubs on /vi/explore', async () => {
    listIndexableTopics.mockResolvedValue(Array.from({ length: 14 }, (_, i) => summary(i + 1)));
    await renderExplore('vi');

    const nav = screen.getByRole('navigation', { name: 'Đề trắc nghiệm theo môn' });
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(12);
    expect(links[0]).toHaveAttribute('href', '/vi/explore/mon-1');
    expect(links[0]).toHaveTextContent('Môn 1');
  });

  it('renders no block without hubs, in /en, or when the read fails', async () => {
    listIndexableTopics.mockResolvedValue([]);
    const { container, unmount } = await renderExplore('vi');
    expect(container.querySelector('#explore-hubs-heading')).toBeNull();
    unmount();

    listIndexableTopics.mockClear().mockResolvedValue([summary(1)]);
    const en = await renderExplore('en');
    expect(en.container.querySelector('#explore-hubs-heading')).toBeNull();
    expect(listIndexableTopics).not.toHaveBeenCalled();
    en.unmount();

    listIndexableTopics.mockRejectedValue(new Error('database unavailable'));
    const failed = await renderExplore('vi');
    expect(failed.container.querySelector('#explore-hubs-heading')).toBeNull();
    expect(loggerError).toHaveBeenCalledWith(
      { error: expect.any(Error) },
      'explore: topic hub links failed',
    );
  });
});

describe('/explore first HTML (RIN-1518)', () => {
  it('renders the page shell without waiting for the hub read', async () => {
    listIndexableTopics.mockReturnValue(new Promise<QuizTopicHubSummaryDto[]>(() => {}));
    const page = await explorePage('vi');

    expect(listIndexableTopics).not.toHaveBeenCalled();
    const boundary = page.props.hubLinks as ReactElement<{ children: ReactElement }>;
    expect(boundary.type).toBe(Suspense);
    expect(boundary.props.children.type).toBe(ExploreTopicHubLinks);
  });

  it('has no route loading.tsx holding the heading and tabs behind a fallback', () => {
    const route = path.join(process.cwd(), 'src/app/[locale]/(app)/explore');
    expect(existsSync(path.join(route, 'page.tsx'))).toBe(true);
    expect(existsSync(path.join(route, 'loading.tsx'))).toBe(false);
  });
});
