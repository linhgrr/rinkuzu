import { redirect } from '@/i18n/navigation';
import { getLandingStarterHref } from '@/lib/dashboard-factory';
import { ROUTES } from '@/shared/constants/routes';

export const dynamic = 'force-dynamic';

/**
 * Homepage play-first button target (RIN-1178). The homepage is force-static, so the
 * starter is picked here: guests (and signed-in visitors) go straight into the first
 * eligible starter quiz for the page locale, or to the public quiz list when there is
 * none. Renders nothing.
 */
export default async function TryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const href = (await getLandingStarterHref(locale)) ?? ROUTES.QUIZZES;
  return redirect({ href, locale });
}
