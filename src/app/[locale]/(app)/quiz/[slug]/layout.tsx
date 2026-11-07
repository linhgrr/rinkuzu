import type { Metadata } from 'next';
import { buildQuizMetadata } from './quiz-metadata';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
};

/**
 * The result and flashcards routes inherit this. The quiz page itself overrides it
 * from page.tsx, which also receives `?mode=` for the quick-link card (RIN-1180).
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  return buildQuizMetadata({ locale, slug, mode: null });
}

export default function QuizSlugLayout({ children }: Props) {
  return children;
}
