import { Link } from '@/i18n/routing';
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
  category?: {
    name: string;
    color: string;
  } | null;
  createdAt: string;
  questions: Array<unknown>;
  questionCount?: number;
}

interface QuizCardProps {
  quiz: Quiz;
  locale?: string;
  questionCountLabel: string;
  uncategorizedLabel: string;
  openLabel: string;
}

function categoryBadgeVariant(color: string) {
  const map: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'purple' | 'default'> = {
    'bg-blue-100': 'info',
    'bg-green-100': 'success',
    'bg-yellow-100': 'warning',
    'bg-red-100': 'danger',
    'bg-purple-100': 'purple',
  };

  return map[color] || 'default';
}

export function QuizCard({
  quiz,
  locale,
  questionCountLabel,
  uncategorizedLabel,
  openLabel,
}: QuizCardProps) {
  return (
    <Link
      href={ROUTES.QUIZ.VIEW(quiz.slug)}
      className="block h-full"
      aria-label={`${openLabel}: ${quiz.title}`}
    >
      <Card
        variant="interactive"
        className="group flex h-full flex-col justify-between rounded-2xl border border-slate-200 shadow-sm transition-all duration-300 hover:border-teal-400 hover:shadow-[0_0_15px_rgba(45,212,191,0.2)]"
      >
        <CardHeader className="pb-3">
          <div className="mb-2 flex items-start justify-between">
            <Badge
              variant={categoryBadgeVariant(quiz.category?.color || '')}
              className="w-fit"
            >
              {quiz.category?.name || uncategorizedLabel}
            </Badge>
          </div>

          <CardTitle
            size="sm"
            className="line-clamp-2 text-base font-bold leading-snug text-slate-800 transition-colors group-hover:text-black"
          >
            {quiz.title}
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-3 text-xs font-medium text-gray-400">
            <span>{questionCountLabel}</span>
            <span>{formatDisplayDate(quiz.createdAt, locale)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
