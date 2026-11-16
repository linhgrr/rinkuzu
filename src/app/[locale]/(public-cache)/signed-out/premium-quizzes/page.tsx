import { setRequestLocale } from 'next-intl/server';
import { PremiumQuizzesPageClient } from '@/features/quiz/components/PremiumQuizzesPageClient';

// The catalog itself loads in the browser; the shell and intro are the same for
// every signed-out visitor (RIN-1770).
export const revalidate = 600;

type Props = { params: Promise<{ locale: string }> };

/** `/premium-quizzes` for a visitor with no session cookie, served from the cache. */
export default async function SignedOutPremiumQuizzesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PremiumQuizzesPageClient />;
}
