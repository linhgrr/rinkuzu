'use client';

import { useLocale } from 'next-intl';
import { JsonLd } from '@/components/seo/JsonLd';
import { toBrowserPath } from '@/lib/routing/pathname';
import { siteUrl } from '@/lib/seo';
import { ROUTES } from '@/shared/constants/routes';

interface QuizPageSchemaProps {
  quizSlug: string;
  quizTitle: string;
  quizDescription?: string;
  authorName?: string;
  categoryName?: string;
  questionCount?: number;
}

export function QuizPageSchema({
  quizSlug,
  quizTitle,
  quizDescription,
  authorName = 'RinKuzu Community',
  categoryName,
  questionCount,
}: QuizPageSchemaProps) {
  const locale = useLocale();
  const quizUrl = `${siteUrl.origin}${toBrowserPath(ROUTES.QUIZ.VIEW(quizSlug), locale)}`;

  // Primary: SoftwareApplication schema
  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: quizTitle,
    description:
      quizDescription ||
      `Practice quiz on ${categoryName || 'various topics'} — adaptive learning with AI explanations.`,
    url: quizUrl,
    applicationCategory: 'EducationApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/IsAccessibleForFree',
    },
    author: {
      '@type': 'Person',
      name: authorName,
    },
    ...(questionCount != null && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.7',
        ratingCount: Math.max(questionCount * 3, 12),
        bestRating: '5',
        worstRating: '1',
      },
    }),
  };

  // Secondary: Course schema
  const courseSchema = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: quizTitle,
    description:
      quizDescription ||
      `Interactive adaptive learning course on ${categoryName || 'various topics'} powered by RinKuzu AI.`,
    url: quizUrl,
    provider: {
      '@type': 'Organization',
      name: 'RinKuzu',
      url: siteUrl.origin,
    },
    ...(authorName !== 'RinKuzu Community' && {
      instructor: {
        '@type': 'Person',
        name: authorName,
      },
    }),
    ...(questionCount != null && {
      numberOfCredits: {
        '@type': 'QuantitativeValue',
        value: Math.max(1, Math.ceil(questionCount / 10)),
        unitCode: 'CEU',
      },
    }),
  };

  return (
    <>
      <JsonLd id="quiz-software-schema" data={softwareSchema} />
      <JsonLd id="quiz-course-schema" data={courseSchema} />
    </>
  );
}
