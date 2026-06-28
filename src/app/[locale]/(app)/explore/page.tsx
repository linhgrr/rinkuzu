import { getServerSession } from 'next-auth';
import { ExploreClient, type ExploreData } from './ExploreClient';
import { authOptions } from '@/lib/auth';
import { serviceFactory } from '@/lib/serviceFactory';

const EXPLORE_PAGE_LIMIT = 12;

function parsePage(value: string | undefined): number {
  const page = Number.parseInt(value || '1', 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const [{ page: rawPage, q }, session] = await Promise.all([
    searchParams,
    getServerSession(authOptions),
  ]);
  const page = parsePage(rawPage);
  const search = q?.trim() ?? '';
  const isGuest = !session?.user;
  const isAdmin = session?.user?.role === 'admin';

  const initialData = (await serviceFactory.getQuizService().getQuizzes({
    search: search || undefined,
    page,
    limit: EXPLORE_PAGE_LIMIT,
    compact: true,
    isPrivate: isGuest || !isAdmin ? false : undefined,
    userRole: session?.user?.role,
    userId: session?.user?.id,
  })) as unknown as ExploreData;

  return <ExploreClient initialData={initialData} initialPage={page} initialSearch={search} />;
}
