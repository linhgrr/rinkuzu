import { Suspense } from 'react';
import { ExplorePageClient } from '@/features/explore/components/ExplorePageClient';
import { TOPIC_HUB_LOCALE } from '@/lib/seo/topic-hub';
import { ExploreTopicHubLinks } from './TopicHubLinks';

type Props = { params: Promise<{ locale: string }> };

export default async function ExplorePage({ params }: Props) {
  const { locale } = await params;
  // Hub links (RIN-1249 B6) exist in `vi` only, and only for indexable hubs.
  // They stream in their own boundary, so the DB read never holds the heading,
  // search and tabs out of the first HTML (RIN-1518). Still server-rendered.
  if (locale !== TOPIC_HUB_LOCALE) return <ExplorePageClient />;
  return (
    <ExplorePageClient
      hubLinks={
        <Suspense fallback={null}>
          <ExploreTopicHubLinks locale={locale} />
        </Suspense>
      }
    />
  );
}
