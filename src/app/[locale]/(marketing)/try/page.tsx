import { redirect } from '@/i18n/navigation';
import { getLandingStarterSlug } from '@/lib/dashboard-factory';
import { ROUTES } from '@/shared/constants/routes';
import { LANDING_ENTRY } from '@/shared/constants/starter-quiz';

export const dynamic = 'force-dynamic';

/**
 * Homepage play-first button target (RIN-1178). The homepage is force-static, so the
 * starter is picked here: guests (and signed-in visitors) go straight into the first
 * eligible starter quiz for the page locale, or to the public quiz list when there is
 * none. Renders nothing.
 */
export default async function TryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const slug = await getLandingStarterSlug(locale);
  const href = slug ? `${ROUTES.QUIZ.VIEW(slug)}?entry=${LANDING_ENTRY}` : ROUTES.QUIZZES;
  return redirect({ href, locale });
}
