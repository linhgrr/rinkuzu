import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { getTranslations } from 'next-intl/server';
import { HiOutlineSearch } from 'react-icons/hi';
import { JsonLd } from '@/components/seo/JsonLd';
import { Badge } from '@/components/ui/Card';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { Link } from '@/i18n/navigation';
import { getQuizTopicHubService } from '@/lib/quiz-topic-hub-factory';
import { routePathSegment } from '@/lib/routing/routeParams';
import { buildLocalizedMetadata } from '@/lib/seo';
import {
  buildTopicHubDescription,
  buildTopicHubJsonLd,
  TOPIC_HUB_LOCALE,
  TOPIC_HUB_QUIZ_LIMIT,
  topicHubPath,
  topicHubPlayHref,
} from '@/lib/seo/topic-hub';
import { QUIZ_TOPIC_SLUG_PATTERN } from '@/shared/constants/quiz-topic';

type Props = { params: Promise<{ locale: string; topic: string }> };

/**
 * Topic hub (RIN-1249, spec RIN-1241 B): the published topic's intro and its
 * indexable quizzes. Vietnamese only; anything else is the existing 404.
 */
const loadHub = cache(async (locale: string, slug: string) => {
  if (locale !== TOPIC_HUB_LOCALE || !QUIZ_TOPIC_SLUG_PATTERN.test(slug)) return null;
  return getQuizTopicHubService().getTopicWithIndexableQuizzes(slug);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, topic } = await params;
  const hub = await loadHub(locale, topic);
  if (!hub) return {};
  const t = await getTranslations({ locale, namespace: 'explore.hub' });
  return buildLocalizedMetadata({
    locale,
    path: topicHubPath(hub.slug),
    title: t('metaTitle', { name: hub.name, count: hub.quizzes.length }),
    description: buildTopicHubDescription(hub.intro),
    languageAlternates: false,
    // B5: below the threshold the hub still renders, but stays out of the index.
    robots: hub.indexable ? { index: true, follow: true } : { index: false, follow: true },
  });
}

export default async function TopicHubPage({ params }: Props) {
  const { locale, topic } = await params;
  const hub = await loadHub(locale, topic);
  if (!hub) notFound();

  const t = await getTranslations({ locale, namespace: 'explore.hub' });
  const quizzes = hub.quizzes.slice(0, TOPIC_HUB_QUIZ_LIMIT);

  return (
    <main className="min-h-[calc(100dvh-5rem)] bg-surface-page px-4 pb-24 pt-6 sm:px-6 lg:px-8">
      <JsonLd
        id="topic-hub-schema"
        data={buildTopicHubJsonLd(
          { ...hub, quizzes },
          { home: t('breadcrumbHome'), explore: t('breadcrumbExplore') },
        )}
      />
      <div className="mx-auto max-w-3xl space-y-6">
        <nav aria-label={t('breadcrumbLabel')}>
          <ol className="flex flex-wrap items-center gap-x-2 text-sm text-ink-muted">
            <li>
              <Link href="/" className="hover:text-accent">
                {t('breadcrumbHome')}
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li>
              <Link href="/explore" className="hover:text-accent">
                {t('breadcrumbExplore')}
              </Link>
            </li>
            <li aria-hidden="true">›</li>
            <li aria-current="page" className="break-words text-ink">
              {hub.name}
            </li>
          </ol>
        </nav>

        <header className="space-y-3">
          <h1 className="break-words font-home text-2xl font-semibold text-ink sm:text-3xl">
            {t('h1', { name: hub.name })}
          </h1>
          {/* An empty hub says so below; "0 bộ câu hỏi" adds nothing (RIN-1404). */}
          {hub.quizzes.length > 0 ? (
            <Badge variant="purple">{t('count', { count: hub.quizzes.length })}</Badge>
          ) : null}
        </header>

        <MarkdownRenderer
          content={hub.intro}
          className="space-y-3 [&_a]:text-accent [&_a]:underline [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-ink [&_img]:hidden [&_li]:text-base [&_li]:text-ink [&_p]:text-base [&_p]:leading-7 [&_p]:text-ink [&_ul]:list-disc [&_ul]:pl-5"
        />

        {quizzes.length > 0 ? (
          <section aria-labelledby="topic-hub-list-heading" className="space-y-4">
            <h2 id="topic-hub-list-heading" className="font-home text-lg font-semibold text-ink">
              {t('listHeading')}
            </h2>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {quizzes.map((quiz) => (
                <li key={quiz.slug}>
                  <div className="flex h-full flex-col justify-between gap-3 rounded-xl border border-secondary-2 bg-surface-blue p-4">
                    <div className="min-w-0 space-y-1">
                      <Link
                        href={`/quiz/${routePathSegment(quiz.slug)}`}
                        className="line-clamp-2 break-words font-home font-medium text-ink hover:text-accent"
                      >
                        {quiz.title}
                      </Link>
                      <p className="text-sm text-ink-muted">
                        {t('questions', { count: quiz.questionCount })}
                      </p>
                    </div>
                    <Link
                      href={topicHubPlayHref(quiz, hub.slug)}
                      aria-label={t('playAria', { title: quiz.title })}
                      className="btn btn-secondary min-h-11 w-full sm:w-auto sm:self-start"
                    >
                      {t('play')}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
            <Link href="/explore" className="inline-block text-sm text-accent">
              {t('more')}
            </Link>
          </section>
        ) : (
          <div className="py-16 text-center">
            <HiOutlineSearch aria-hidden="true" className="mx-auto mb-4 size-14 text-ink-muted" />
            <h2 className="font-home text-xl font-semibold text-ink">{t('emptyTitle')}</h2>
            <p className="mx-auto mt-2 max-w-lg font-home text-ink-muted">{t('emptyText')}</p>
            <Link href="/explore" className="btn btn-secondary mt-6 min-h-11">
              {t('emptyCta')}
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
