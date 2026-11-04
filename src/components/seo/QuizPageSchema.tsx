import { JsonLd } from '@/components/seo/JsonLd';
import { canonicalFor, siteUrl } from '@/lib/seo';

interface QuizPageSchemaProps {
  locale: string;
  quizSlug: string;
  quizTitle: string;
  quizDescription?: string;
  /** The author's real name; without one RinKuzu is the author (RIN-840). */
  authorName?: string;
  categoryName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function QuizPageSchema({
  locale,
  quizSlug,
  quizTitle,
  quizDescription,
  authorName,
  categoryName,
  createdAt,
  updatedAt,
}: QuizPageSchemaProps) {
  const quizUrl = canonicalFor(locale, `/quiz/${quizSlug}`);
  const personName = authorName?.trim();
  const description =
    quizDescription ||
    (locale === 'vi'
      ? `Luyện tập quiz ${categoryName || 'nhiều chủ đề'} trên RinKuzu.`
      : `Practice a ${categoryName || 'general knowledge'} quiz on RinKuzu.`);

  const quizSchema = {
    '@context': 'https://schema.org',
    '@type': 'Quiz',
    name: quizTitle,
    description,
    url: quizUrl,
    inLanguage: locale,
    learningResourceType: 'Quiz',
    educationalUse: 'Practice',
    isAccessibleForFree: true,
    ...(createdAt ? { dateCreated: createdAt } : {}),
    ...(updatedAt ? { dateModified: updatedAt } : {}),
    author: personName
      ? {
          '@type': 'Person',
          name: personName,
        }
      : {
          '@type': 'Organization',
          name: 'RinKuzu',
          url: siteUrl.origin,
        },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': quizUrl,
    },
  };

  return <JsonLd id="quiz-schema" data={quizSchema} />;
}
