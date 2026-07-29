import type { Metadata } from 'next';
import { serviceFactory } from '@/lib/serviceFactory';
import { buildLocalizedMetadata } from '@/lib/seo';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;

  const defaultMetadata = buildLocalizedMetadata({
    locale,
    path: `/quiz/${slug}`,
    title: locale === 'vi' ? 'Luyện tập quiz | RinKuzu' : 'Practice Quiz | RinKuzu',
    description:
      locale === 'vi'
        ? 'Luyện tập quiz từ tài liệu học tập và nhận phản hồi ngay trên RinKuzu.'
        : 'Take interactive quizzes generated from learning materials and get instant feedback.',
    robots: {
      index: false,
      follow: false,
    },
  });

  try {
    const quizService = serviceFactory.getQuizService();
    const quiz = await quizService.getQuizMetadataBySlug(slug);
    if (!quiz) {
      return defaultMetadata;
    }

    const isIndexable = !quiz.isPrivate;
    return buildLocalizedMetadata({
      locale,
      path: `/quiz/${slug}`,
      title: `${quiz.title} | RinKuzu`,
      description:
        quiz.description ||
        (locale === 'vi'
          ? 'Luyện tập quiz trên RinKuzu với lời giải rõ ràng và kết quả chi tiết.'
          : 'Practice reviewed quizzes on RinKuzu with clear explanations and detailed results.'),
      robots: {
        index: isIndexable,
        follow: isIndexable,
      },
    });
  } catch (error) {
    console.error('quiz metadata generation failed', error);
    return defaultMetadata;
  }
}

export default function QuizSlugLayout({ children }: Props) {
  return children;
}
