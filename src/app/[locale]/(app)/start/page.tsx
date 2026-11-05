import { cookies } from 'next/headers';
import { redirect } from '@/i18n/navigation';
import { getCurrentSession } from '@/lib/auth/session';
import { getPostSignInHref } from '@/lib/dashboard-factory';
import { ROUTES } from '@/shared/constants/routes';
import { STARTER_SKIPPED_COOKIE } from '@/shared/constants/starter-quiz';

export const dynamic = 'force-dynamic';

/**
 * Post-sign-in landing (RIN-913). Sign-in with no explicit destination comes
 * here: a new learner goes straight into the starter quiz, everyone else (and
 * anyone who pressed Skip in this browser) to the dashboard. Renders nothing;
 * every failure falls back to the dashboard inside getPostSignInHref.
 */
export default async function StartPage({ params }: { params: Promise<{ locale: string }> }) {
  const [{ locale }, session, cookieStore] = await Promise.all([
    params,
    getCurrentSession(),
    cookies(),
  ]);

  if (!session?.user) {
    return redirect({ href: ROUTES.LOGIN, locale });
  }

  const href = await getPostSignInHref({
    userId: session.user.id,
    locale,
    starterSkipped: cookieStore.has(STARTER_SKIPPED_COOKIE),
  });
  return redirect({ href, locale });
}
