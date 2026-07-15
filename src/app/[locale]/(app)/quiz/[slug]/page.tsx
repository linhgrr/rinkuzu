import { getCurrentSession } from '@/lib/auth/session';
import { serviceFactory } from '@/lib/serviceFactory';
import { toQuizPlayViewModel } from '@/features/quiz/mappers/quiz-play.mapper';
import QuizPlayerClient from './QuizPlayerClient';

export const dynamic = 'force-dynamic';

export default async function QuizPlayerPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const [{ slug }, session] = await Promise.all([params, getCurrentSession()]);
  const result = await serviceFactory
    .getQuizService()
    .getQuizForPlay(slug, session?.user?.role, session?.user?.id);

  if (!result.success) {
    return (
      <QuizPlayerClient
        initialErrorCode={result.code}
        initialErrorMessage={result.error}
        initialQuiz={null}
        slug={slug}
      />
    );
  }

  return (
    <QuizPlayerClient
      initialErrorCode={null}
      initialErrorMessage={null}
      initialQuiz={toQuizPlayViewModel(result.data)}
      slug={slug}
    />
  );
}
