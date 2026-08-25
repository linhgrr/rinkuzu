import type { PremiumCatalogItemViewModel } from '@/features/quiz/api/premium-quiz-api';
import { QuizCard, QuizCardSkeleton } from '@/features/quiz/components/QuizCard';

export function PremiumCatalogCard({ item }: { item: PremiumCatalogItemViewModel }) {
  return (
    <QuizCard
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
