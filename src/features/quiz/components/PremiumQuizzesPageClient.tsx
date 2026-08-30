'use client';

import Image from 'next/image';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { HiOutlineSearch } from 'react-icons/hi';
import { ErrorState } from '@/components/ui/ErrorState';
import Pagination from '@/components/ui/Pagination';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ExploreSearchInput } from '@/features/explore/components/ExploreSearchInput';
import {
  buildPremiumCatalogKey,
  fetchPremiumCatalog,
  type PremiumCatalogListViewModel,
} from '@/features/quiz/api/premium-quiz-api';
import {
  PremiumCatalogCard,
  PremiumCatalogCardSkeleton,
} from '@/features/quiz/components/PremiumCatalogCard';
import { useRouter } from '@/i18n/navigation';
import { ROUTES } from '@/shared/constants/routes';

const PAGE_SIZE = 12;

function parsePage(value: string | null) {
  const page = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function PremiumCatalogSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <PremiumCatalogCardSkeleton key={`premium-page-skeleton-${index}`} />
      ))}
    </div>
  );
}

function PremiumQuizzesContent() {
  const t = useTranslations('premium');
  const { replace } = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.get('q')?.trim() ?? '';
  const page = parsePage(searchParams.get('page'));
  const key = buildPremiumCatalogKey({ search, page, limit: PAGE_SIZE });
  const { data, error, isLoading, mutate } = useSWR<PremiumCatalogListViewModel>(
    key,
    fetchPremiumCatalog,
    { keepPreviousData: true },
  );

  function updateUrl(next: { search?: string; page?: number }) {
    const nextSearch = next.search ?? search;
    const nextPage = next.page ?? page;
    const params = new URLSearchParams();
    if (nextSearch.trim()) params.set('q', nextSearch.trim());
    if (nextPage > 1) params.set('page', String(nextPage));
    const query = params.toString();
    replace(query ? `${ROUTES.PREMIUM_QUIZZES}?${query}` : ROUTES.PREMIUM_QUIZZES, {
      scroll: false,
    });
  }

  return (
    <main className="min-h-[calc(100dvh-5rem)] bg-surface-page px-4 pb-24 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-app">
        <SurfaceCard className="overflow-hidden border-accent/20 p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Image
              src="/images/premium-credit-coin.png"
              alt=""
              width={104}
              height={104}
              className="size-20 shrink-0 object-contain sm:size-24"
              priority
            />
            <div className="min-w-0">
              <p className="font-home text-sm font-semibold uppercase tracking-wide text-accent">
                Quiz Premium
              </p>
              <h1 className="mt-1 font-home text-2xl font-semibold text-ink sm:text-3xl">
                {t('catalogPageTitle')}
              </h1>
              <p className="mt-2 max-w-3xl font-home text-sm leading-6 text-ink-muted sm:text-base">
                {t('catalogPageSubtitle')}
              </p>
            </div>
          </div>
        </SurfaceCard>

        <div className="mt-5 max-w-2xl">
          <ExploreSearchInput
            key={search}
            initialQuery={search}
            placeholder={t('catalogSearchPlaceholder')}
            onCommit={(nextSearch) => updateUrl({ search: nextSearch, page: 1 })}
          />
        </div>

        <SurfaceCard className="mt-5 p-4 sm:p-5">
          {isLoading ? (
            <PremiumCatalogSkeleton />
          ) : error ? (
            <ErrorState message={t('catalogLoadError')} onRetry={() => void mutate()} />
          ) : data && data.items.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.items.map((item) => (
                <PremiumCatalogCard key={item.quizId} item={item} />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <HiOutlineSearch className="mx-auto mb-4 size-14 text-ink-muted" />
              <h2 className="font-home text-xl font-semibold text-ink">
                {search ? t('catalogNoResults') : t('catalogEmpty')}
              </h2>
            </div>
          )}
        </SurfaceCard>

        {data && data.totalPages > 1 ? (
          <div className="flex justify-center pt-6">
            <Pagination
              currentPage={data.page}
              totalPages={data.totalPages}
              onPageChange={(nextPage) => updateUrl({ page: nextPage })}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}

export function PremiumQuizzesPageClient() {
  return (
    <Suspense fallback={<PremiumCatalogSkeleton />}>
      <PremiumQuizzesContent />
    </Suspense>
  );
}
