import { redirect } from '@/i18n/navigation';
import { getBlogTryHref, getLandingStarterHref } from '@/lib/dashboard-factory';
import { ROUTES } from '@/shared/constants/routes';
import { BLOG_ENTRY, isBlogPostSlug } from '@/shared/constants/starter-quiz';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

/** A single well-formed slug param (`^[a-z0-9-]{1,80}$`), else undefined: never an error. */
const slugParam = (value: string | string[] | undefined): string | undefined =>
  isBlogPostSlug(value) ? value : undefined;

const resolveHref = async (locale: string, query: SearchParams): Promise<string | null> => {
  if (query['entry'] !== BLOG_ENTRY) return getLandingStarterHref(locale);
  const post = slugParam(query['post']);
  const quiz = slugParam(query['quiz']);
  return getBlogTryHref(locale, {
    ...(post ? { post } : {}),
    ...(quiz ? { quiz } : {}),
  });
};

/**
 * Play-first target (RIN-1178). The homepage is force-static, so the starter is picked
 * here: guests (and signed-in visitors) go straight into the first eligible starter quiz
 * for the page locale, or to the public quiz list when there is none. A blog card
 * (`?entry=blog&post=<slug>[&quiz=<slug>]`, RIN-1258) opens its quiz when it is playable,
 * else the same starter, keeping entry and post. Renders nothing.
 */
export default async function TryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { locale } = await params;
  const href = (await resolveHref(locale, await searchParams)) ?? ROUTES.QUIZZES;
  return redirect({ href, locale });
}
