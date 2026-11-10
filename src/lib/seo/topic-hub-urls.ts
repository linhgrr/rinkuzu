import { routePathSegment } from '@/lib/routing/routeParams';
import { canonicalFor } from '@/lib/seo';

/**
 * Topic hub paths and the absolute URLs that change when an admin edits a hub
 * (RIN-1500). Pure: no database, no factory, so admin services can import it.
 */
export function topicHubPath(slug: string): string {
  return `/explore/${routePathSegment(slug)}`;
}

/** What a hub page and the `/explore` hub list show of one topic. */
export interface TopicHubFacts {
  slug: string;
  locale: string;
  name: string;
  intro: string;
  order: number;
  published: boolean;
}

/** The fields `/explore` shows (or orders by) for a topic; the intro is only on the hub. */
function changesExploreList(before: TopicHubFacts, after: TopicHubFacts): boolean {
  return (
    before.published !== after.published ||
    before.slug !== after.slug ||
    before.name !== after.name ||
    before.order !== after.order
  );
}

/**
 * The public URLs to re-crawl after a topic changed from `before` to `after`:
 * each published hub page (the old one too after a slug change or unpublish),
 * plus `/explore` when its list of hubs changed. A topic that is a draft on
 * both sides changes nothing public, so it yields no URL.
 */
export function topicHubChangeUrls(before: TopicHubFacts, after: TopicHubFacts): string[] {
  const urls = new Set<string>();
  for (const topic of [before, after]) {
    if (topic.published) urls.add(canonicalFor(topic.locale, topicHubPath(topic.slug)));
  }
  if (urls.size > 0 && changesExploreList(before, after)) {
    urls.add(canonicalFor(after.locale, '/explore'));
  }
  return [...urls];
}
