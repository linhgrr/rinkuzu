import { setRequestLocale } from 'next-intl/server';
import { loadExploreHubLinks } from '@/app/[locale]/(app)/explore/TopicHubLinks';
import { CachedExplorePageClient } from '@/features/explore/components/ExplorePageClient';

// Hub links change rarely; the list itself loads on the client (RIN-1646).
export const revalidate = 600;

type Props = { params: Promise<{ locale: string }> };

/** `/explore` for a visitor with no session cookie, served from the cache. */
export default async function SignedOutExplorePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const hubLinks = await loadExploreHubLinks(locale);
  return <CachedExplorePageClient hubLinks={hubLinks} />;
}
