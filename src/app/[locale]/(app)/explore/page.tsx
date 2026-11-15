import { ExplorePageClient } from '@/features/explore/components/ExplorePageClient';
import { loadExploreHubLinks } from './TopicHubLinks';

type Props = { params: Promise<{ locale: string }> };

export default async function ExplorePage({ params }: Props) {
  const { locale } = await params;
  // Hub links (RIN-1249 B6) exist in `vi` only, and only for indexable hubs.
  const hubLinks = await loadExploreHubLinks(locale);
  return <ExplorePageClient hubLinks={hubLinks} />;
}
