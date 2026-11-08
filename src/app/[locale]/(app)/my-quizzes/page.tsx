import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import ProfileQuizzes from '@/features/profile/components/ProfileQuizzes';
import { buildLocalizedMetadata } from '@/lib/seo';
import { noIndexMetadata } from '@/lib/seo/no-index-metadata';

type MyQuizzesPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
};

function activeTab(tab: string | undefined) {
  return tab === 'folders' ? 'folders' : 'quizzes';
}

// RIN-1200: the title follows the active tab, like the page h1. The layout's
// metadata covers the nested folder pages.
export async function generateMetadata({
  params,
  searchParams,
}: MyQuizzesPageProps): Promise<Metadata> {
  const [{ locale }, { tab }] = await Promise.all([params, searchParams]);
  const isFolders = activeTab(tab) === 'folders';
  const t = await getTranslations({
    locale,
    namespace: isFolders ? 'profile.meta.folders' : 'profile.meta.myQuizzes',
  });
  return buildLocalizedMetadata({
    locale,
    path: '/my-quizzes',
    title: t('title'),
    description: t('description'),
    ...(noIndexMetadata.robots ? { robots: noIndexMetadata.robots } : {}),
  });
}

export default async function MyQuizzesPage({ searchParams }: MyQuizzesPageProps) {
  const tab = activeTab((await searchParams).tab);
  return <ProfileQuizzes tab={tab} />;
}
