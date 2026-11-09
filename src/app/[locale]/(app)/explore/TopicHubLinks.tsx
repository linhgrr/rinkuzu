import { Link } from '@/i18n/navigation';
import { topicHubPath } from '@/lib/seo/topic-hub';

export interface TopicHubLink {
  slug: string;
  name: string;
}

/**
 * "Đề trắc nghiệm theo môn" on `/vi/explore` (RIN-1249, spec RIN-1241 B6):
 * server-rendered links to the indexable hubs. The caller renders nothing
 * when there are none.
 */
export function TopicHubLinks({ heading, hubs }: { heading: string; hubs: TopicHubLink[] }) {
  return (
    <nav aria-labelledby="explore-hubs-heading" className="mt-4">
      <h2 id="explore-hubs-heading" className="font-home text-lg font-semibold text-ink">
        {heading}
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {hubs.map((hub) => (
          <li key={hub.slug}>
            <Link
              href={topicHubPath(hub.slug)}
              className="inline-flex min-h-11 items-center rounded-full border border-secondary-2 bg-surface-blue px-4 font-home text-sm font-medium text-ink hover:text-accent"
            >
              {hub.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
