import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { getBlogTryHref, getLandingStarterHref } from '@/lib/dashboard-factory';
import { toBrowserPath } from '@/lib/routing/pathname';
import { ROUTES } from '@/shared/constants/routes';
import { BLOG_ENTRY, isBlogPostSlug } from '@/shared/constants/starter-quiz';

type Context = { params: Promise<{ locale: string }> };

/**
 * Shared CDN cache (RIN-1645): the target depends only on the locale and the query (the
 * Vercel cache key includes the query string), never on the visitor, so a hit runs no
 * Function. A new starter shows up within 10 minutes.
 */
const TRY_CACHE_CONTROL = 'public, s-maxage=600, stale-while-revalidate=86400';

/**
 * The quiz-list fallback is also what a failed starter lookup returns, so it is cached
 * for one minute only: a database blip must not send every visitor to the list for a day.
 */
const FALLBACK_CACHE_CONTROL = 'public, s-maxage=60';

/**
 * A single well-formed slug param (`^[a-z0-9-]{1,80}$`), else undefined: never an error.
 * A repeated param is dropped, as the page did with an array.
 */
const slugParam = (query: URLSearchParams, name: string): string | undefined => {
  const [value, ...rest] = query.getAll(name);
  return rest.length === 0 && isBlogPostSlug(value) ? value : undefined;
};

const resolveHref = async (locale: string, query: URLSearchParams): Promise<string | null> => {
  if (query.get('entry') !== BLOG_ENTRY) return getLandingStarterHref(locale);
  const post = slugParam(query, 'post');
  const quiz = slugParam(query, 'quiz');
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
 * else the same starter, keeping entry and post. A route handler, not a page, so the
 * 307 carries a shared cache header (RIN-1645). The Location is path-only and
 * locale-prefixed, like `redirect` from `@/i18n/navigation`.
 */
export async function GET(request: Request, { params }: Context): Promise<Response> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return new Response(null, { status: 404 });
  const query = new URL(request.url).searchParams;
  const href = await resolveHref(locale, query);
  return new Response(null, {
    status: 307,
    headers: {
      Location: toBrowserPath(href ?? ROUTES.QUIZZES, locale),
      'Cache-Control': href ? TRY_CACHE_CONTROL : FALLBACK_CACHE_CONTROL,
    },
  });
}
