import type { Metadata } from 'next';
import { buildLocalizedMetadata } from '@/lib/seo';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildLocalizedMetadata({
    locale,
    path: '/quizzes',
    title: 'Browse Quizzes | RinKuzu',
    description:
      'Browse public and Premium private quizzes from the RinKuzu community and start practicing right away.',
  });
}

export default function QuizzesLayout({ children }: Props) {
  return children;
}
