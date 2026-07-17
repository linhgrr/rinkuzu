import type { LibraryListDto, LibraryQuizDto } from '@/dtos/review';
import type {
  ProfileQuizLibraryViewModel,
  ProfileQuizMonthGroupViewModel,
  ProfileQuizViewModel,
} from '@/features/profile/types/profile-quiz-view-model';
import { formatDate } from '@/lib/formatters';
import { groupQuizzesByMonthAndWeek } from '@/features/profile/lib/quizDateGroups';

interface ProfileQuizMonthGroupsInput {
  quizzes: ProfileQuizViewModel[];
  locale: string;
}

function toProfileQuizViewModel(quiz: LibraryQuizDto): ProfileQuizViewModel {
  return {
    id: quiz.id,
    title: quiz.title,
    slug: quiz.slug,
    author: quiz.author,
    isPrivate: quiz.isPrivate,
    questionCount: quiz.questionCount,
    ownedByMe: quiz.ownedByMe,
    createdAt: quiz.createdAt,
    updatedAt: quiz.updatedAt,
    libraryStatus: quiz.libraryStatus,
    displayDate: quiz.displayDate,
  };
}

export function toProfileQuizLibraryViewModel(dto: LibraryListDto): ProfileQuizLibraryViewModel {
  return {
    quizzes: dto.quizzes.map(toProfileQuizViewModel),
  };
}

export function toProfileQuizMonthGroupsViewModel({
  quizzes,
  locale,
}: ProfileQuizMonthGroupsInput): ProfileQuizMonthGroupViewModel[] {
  return groupQuizzesByMonthAndWeek(quizzes).map((month) => ({
    key: month.key,
    label: formatDate(month.date, {
      locale: locale === 'vi' ? 'vi' : 'en',
      options: { month: 'long', year: 'numeric' },
    }),
    quizzes: month.weeks.flatMap((week) => week.quizzes),
  }));
}
