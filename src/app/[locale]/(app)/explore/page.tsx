import { getTranslations } from 'next-intl/server';
import { ExplorePageClient } from '@/features/explore/components/ExplorePageClient';
import {
  EXPLORE_HUB_LINK_LIMIT,
  loadIndexableTopicHubs,
  TOPIC_HUB_LOCALE,
} from '@/lib/seo/topic-hub';
import { TopicHubLinks } from './TopicHubLinks';

type Props = { params: Promise<{ locale: string }> };

export default async function ExplorePage({ params }: Props) {
  const { locale } = await params;
  // Hub links (RIN-1249 B6) exist in `vi` only, and only for indexable hubs.
  const hubs =
    locale === TOPIC_HUB_LOCALE
      ? (await loadIndexableTopicHubs('explore: topic hub links failed')).slice(
          0,
          EXPLORE_HUB_LINK_LIMIT,
        )
      : [];
  if (hubs.length === 0) return <ExplorePageClient />;
  const t = await getTranslations({ locale, namespace: 'explore.hub' });
  return <ExplorePageClient hubLinks={<TopicHubLinks heading={t('linksHeading')} hubs={hubs} />} />;
}
