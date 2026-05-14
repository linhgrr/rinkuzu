import type { Metadata } from 'next';
import { buildLocalizedMetadata } from '@/lib/seo';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
};

function humanizeSlug(slug: string): string {
  let result = '';
  let nextUpper = true;

  for (const char of slug) {
    if (char === '-') {
      if (result) {
        result += ' ';
      }
      nextUpper = true;
      continue;
    }

    result += nextUpper ? char.toUpperCase() : char;
    nextUpper = false;
  }

  return result.trim();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const topic = humanizeSlug(slug);

  return buildLocalizedMetadata({
    locale,
    path: `/category/${slug}`,
    title: `${topic} Quizzes | RinKuzu`,
    description: `Practice quizzes in the ${topic} category to improve mastery and retention.`,
  });
}

export default function CategorySlugLayout({ children }: Props) {
  return children;
}
