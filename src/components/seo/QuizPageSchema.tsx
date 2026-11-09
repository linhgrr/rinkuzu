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
  /** The quiz's topic hub name (RIN-1241 C11), as `about`. */
  topicName?: string;
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
  topicName,
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
    ...(topicName ? { about: { '@type': 'Thing', name: topicName } } : {}),
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

interface QuizBreadcrumbSchemaProps {
  locale: string;
  quizSlug: string;
  quizTitle: string;
  /** The quiz's topic hub: name and unprefixed path, e.g. `/explore/sinh-hoc` (RIN-1249). */
  topic?: { name: string; path: string };
}

/** Home › Explore › {topic} › quiz (RIN-1241 C11); the topic step only when the quiz has one. */
export function QuizBreadcrumbSchema({
  locale,
  quizSlug,
  quizTitle,
  topic,
}: QuizBreadcrumbSchemaProps) {
  const isVietnamese = locale === 'vi';
  const steps = [
    { name: isVietnamese ? 'Trang chủ' : 'Home', path: '/' },
    { name: isVietnamese ? 'Khám phá' : 'Explore', path: '/explore' },
    ...(topic ? [topic] : []),
    { name: quizTitle, path: `/quiz/${quizSlug}` },
  ];
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: steps.map((step, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: step.name,
      item: canonicalFor(locale, step.path),
    })),
  };

  return <JsonLd id="quiz-breadcrumb-schema" data={breadcrumbSchema} />;
}
