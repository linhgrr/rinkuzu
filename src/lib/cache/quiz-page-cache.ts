import { revalidatePath } from 'next/cache';
import { routing } from '@/i18n/routing';
import { logger } from '@/lib/logger';
import { signedOutTwinQuizPath } from '@/lib/routing/public-cache';

/**
 * The cached pages of one quiz: its public URL and the signed-out twin the
 * proxy serves from the cache (RIN-1647, spec RIN-1642 AC 2), in every locale.
 */
function quizPagePaths(slug: string): string[] {
  const segment = encodeURIComponent(slug);
  return routing.locales.flatMap((locale) => [
    `/${locale}/quiz/${segment}`,
    signedOutTwinQuizPath(locale, segment),
  ]);
}

/**
 * Drops the cached signed-out pages of the given quiz slugs, so an edit, a hide,
 * a delete, a Premium decision or a new slug shows at once instead of after the
 * 10-minute revalidate. Pass the old slug together with the new one after a
 * re-slug. Never throws: outside a request (scripts) there is nothing to
 * revalidate, and a failure must not undo the write that called it.
 */
export function revalidateQuizPages(slugs: ReadonlyArray<string | null | undefined>): void {
  const unique = new Set(slugs.filter((slug): slug is string => Boolean(slug)));
  for (const slug of unique) {
    try {
      for (const path of quizPagePaths(slug)) revalidatePath(path);
    } catch (error) {
      logger.warn({ error, slug }, 'quiz page revalidation failed');
    }
  }
}
