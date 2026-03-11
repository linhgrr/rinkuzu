import type { Metadata } from 'next';
import { serviceFactory } from '@/lib/serviceFactory';
import { buildLocalizedMetadata } from '@/lib/seo';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;

  const fallback = buildLocalizedMetadata({
    locale,
    path: `/quiz/${slug}`,
    title: 'Quiz hoc tap | RinKuzu',
    description: 'Luyen tap quiz duoc tao tu tai lieu va danh gia ket qua ngay lap tuc.',
  });

  try {
    const quizService = serviceFactory.getQuizService();
    const quiz = await quizService.getQuizBySlug(slug);
    if (!quiz) {
      return {
        ...fallback,
        robots: {
          index: false,
          follow: false,
        },
      };
    }

    const isIndexable = quiz.status === 'published' && !quiz.isPrivate;
    return buildLocalizedMetadata({
      locale,
      path: `/quiz/${slug}`,
      title: `${quiz.title} | RinKuzu`,
      description:
        quiz.description ||
        'Luyen tap quiz da kiem duyet tren RinKuzu voi giao dien than thien va ket qua chi tiet.',
      robots: {
        index: isIndexable,
        follow: isIndexable,
      },
    });
  } catch (error) {
    console.error('quiz metadata generation failed', error);
    return fallback;
  }
}

export default function QuizSlugLayout({ children }: Props) {
  return children;
}
