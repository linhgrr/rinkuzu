import type { Metadata } from 'next';
import { GuestResumeBannerForApp } from '@/features/quiz/components/guest-resume/GuestResumeBannerForApp';
import { buildLocalizedMetadata } from '@/lib/seo';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isVi = locale === 'vi';
  return buildLocalizedMetadata({
    locale,
    path: '/explore',
    title: isVi ? 'Khám phá quiz | RinKuzu' : 'Explore Quizzes | RinKuzu',
    description: isVi
      ? 'Khám phá quiz theo chủ đề và bắt đầu luyện tập ngay trên RinKuzu.'
      : 'Browse curated quizzes by topic and start practicing right away.',
  });
}

/** The returning-guest resume strip sits first in the page, under the fixed top bar (RIN-1714). */
export default function ExploreLayout({ children }: Props) {
  return (
    <>
      <GuestResumeBannerForApp page="explore" mainId="app-main-content" />
      {children}
    </>
  );
}
