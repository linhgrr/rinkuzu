import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import ProfileBookmarks from '@/features/profile/components/ProfileBookmarks';
import type { BookmarksData } from '@/features/profile/components/ProfileBookmarks';
import { ProfilePageShell } from '@/features/profile/components/ProfilePageShell';
import { authOptions } from '@/lib/auth';
import { defaultLocale } from '@/i18n/config';
import { serviceFactory } from '@/lib/serviceFactory';

const BOOKMARKS_PAGE_LIMIT = 10;

export default async function BookmarksPage({ params }: { params: Promise<{ locale: string }> }) {
  const [{ locale }, session] = await Promise.all([params, getServerSession(authOptions)]);

  if (!session?.user?.email) {
    const loginPath = locale === defaultLocale ? '/login' : `/${locale}/login`;
    const callbackPath = locale === defaultLocale ? '/bookmarks' : `/${locale}/bookmarks`;
    redirect(`${loginPath}?callbackUrl=${encodeURIComponent(callbackPath)}`);
  }

  const initialData = (await serviceFactory
    .getBookmarkService()
    .getBookmarksByUser(session.user.email, {
      page: 1,
      limit: BOOKMARKS_PAGE_LIMIT,
    })) as unknown as BookmarksData;

  return (
    <ProfilePageShell>
      <ProfileBookmarks initialData={initialData} />
    </ProfilePageShell>
  );
}
