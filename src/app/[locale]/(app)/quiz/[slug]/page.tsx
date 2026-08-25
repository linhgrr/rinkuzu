import { getCurrentSession } from '@/lib/auth/session';
import { getQuizService } from '@/lib/quiz-factory';
import { toQuizPlayViewModel } from '@/features/quiz/mappers/quiz-play.mapper';
import type { QuizPlayAuthorViewModel } from '@/features/quiz/types/quiz-play-view-model';
import { QuizPageSchema } from '@/components/seo/QuizPageSchema';
import { getUserDisplayName } from '@/components/user/user-identity';
import QuizPlayerClient from './QuizPlayerClient';
import PremiumQuizPlayerClient from './PremiumQuizPlayerClient';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';

export const dynamic = 'force-dynamic';

export default async function QuizPlayerPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const [{ locale, slug }, session] = await Promise.all([params, getCurrentSession()]);
  const premiumMetadata = await getPremiumQuizService().getCatalogMetadataBySlug(slug);
  if (premiumMetadata) {
    return (
      <PremiumQuizPlayerClient
        quizId={premiumMetadata.quizId}
        slug={slug}
        title={premiumMetadata.title}
        questionCount={premiumMetadata.questionCount}
      />
    );
  }
  const result = await getQuizService().getQuizForPlay(
    slug,
    session?.user?.role,
    session?.user?.id,
  );

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

  const quiz = toQuizPlayViewModel(result.data);
  const author: QuizPlayAuthorViewModel | null = quiz.author;
  const authorName = author ? getUserDisplayName(author) : 'RinKuzu Community';
  const fallbackDescription =
    locale === 'vi'
      ? `Luyện tập ${quiz.questionCount} câu hỏi trong quiz ${quiz.title} trên RinKuzu.`
      : `Practice ${quiz.questionCount} questions in ${quiz.title} on RinKuzu.`;

  return (
    <>
      {quiz.visibility === 'public' ? (
        <>
          <section className="sr-only" aria-labelledby="quiz-page-title">
            <h1 id="quiz-page-title">{quiz.title}</h1>
            <p>{quiz.description || fallbackDescription}</p>
          </section>
          <QuizPageSchema
            locale={locale}
            quizSlug={slug}
            quizTitle={quiz.title}
            {...(quiz.description ? { quizDescription: quiz.description } : {})}
            authorName={authorName}
            createdAt={quiz.createdAt}
            updatedAt={quiz.updatedAt}
          />
        </>
      ) : null}
      <QuizPlayerClient
        initialErrorCode={null}
        initialErrorMessage={null}
        initialQuiz={quiz}
        slug={slug}
      />
    </>
  );
}
