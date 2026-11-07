import { useTranslations } from 'next-intl';
import type { PremiumCatalogItemViewModel } from '@/features/quiz/api/premium-quiz-api';
import { QuizCard, QuizCardSkeleton } from '@/features/quiz/components/QuizCard';

export function PremiumCatalogCard({ item }: { item: PremiumCatalogItemViewModel }) {
  const t = useTranslations('premium');
  return (
    <QuizCard
      badge={item.unlocked ? t('catalogUnlockedBadge') : undefined}
      quizId={item.quizId}
      quiz={{
        title: item.title,
        slug: item.slug,
        author: null,
        visibility: 'public',
        questionCount: item.questionCount,
      }}
    />
  );
}

export function PremiumCatalogCardSkeleton() {
  return <QuizCardSkeleton />;
}
