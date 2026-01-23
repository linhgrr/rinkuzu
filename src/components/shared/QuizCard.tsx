'use client';

import { memo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  Badge,
} from '@/components/ui/Card';
import { ROUTES } from '@/shared/constants';
import { formatDisplayDate } from '@/shared/utils/constants';

interface Quiz {
  _id: string;
  title: string;
  slug: string;
  category: {
    name: string;
    color: string;
  };
  createdAt: string;
  questions: Array<unknown>;
}

interface QuizCardProps {
  quiz: Quiz;
}

const CategoryBadgeVariant = (color: string) => {
  const map: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'purple' | 'default'> = {
    'bg-blue-100': 'info',
    'bg-green-100': 'success',
    'bg-yellow-100': 'warning',
    'bg-red-100': 'danger',
    'bg-purple-100': 'purple',
  };
  return map[color] || 'default';
};

export const QuizCard = memo(function QuizCard({ quiz }: QuizCardProps) {
  const router = useRouter();
  const t = useTranslations('common');

  const handleClick = useCallback(() => {
    router.push(ROUTES.QUIZ.VIEW(quiz.slug));
  }, [router, quiz.slug]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      router.push(ROUTES.QUIZ.VIEW(quiz.slug));
    }
  }, [router, quiz.slug]);

  return (
    <Card
      variant="interactive"
      className="flex flex-col justify-between h-full rounded-2xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-300"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Open quiz: ${quiz.title}`}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start mb-2">
          <Badge
            variant={CategoryBadgeVariant(quiz.category?.color)}
            className="w-fit"
          >
            {quiz.category?.name}
          </Badge>
        </div>

        <CardTitle size="sm" className="line-clamp-2 text-base font-bold text-gray-800 leading-snug group-hover:text-blue-600 transition-colors">
          {quiz.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-xs font-medium text-gray-400 mt-2 pt-3 border-t border-gray-100">
          <span>{t('questionsCount', { count: quiz.questions.length })}</span>
          <span>{formatDisplayDate(quiz.createdAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
});
