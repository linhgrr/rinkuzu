'use client';

import { memo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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

  const handleClick = useCallback(() => {
    router.push(ROUTES.QUIZ.VIEW(quiz.slug));
  }, [router, quiz.slug]);

  return (
    <Card
      variant="interactive"
      className="flex flex-col justify-between"
      onClick={handleClick}
    >
      <CardHeader className="pb-2">
        <Badge
          variant={CategoryBadgeVariant(quiz.category?.color)}
          className="w-fit mb-2"
        >
          {quiz.category?.name}
        </Badge>
        <CardTitle size="sm" className="line-clamp-2">
          {quiz.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-xs text-[#86868b] mt-2">
          <span>{quiz.questions.length} questions</span>
          <span>{formatDisplayDate(quiz.createdAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
});
