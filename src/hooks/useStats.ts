'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { fetcher } from '@/lib/fetcher';

interface UserStats {
  streak: number;
  xp: number;
  level: number;
  dueCount: number;
  streakFreezeCount: number;
  weeklyActivity: unknown;
}

interface BuyFreezeResponse {
  success: boolean;
  message?: string;
  data?: {
    xp: number;
    streakFreezeCount: number;
  };
}

async function buyFreezeFetcher(url: string) {
  const res = await fetch(url, { method: 'POST' });
  return res.json() as Promise<BuyFreezeResponse>;
}

export function useStats() {
  const { data, error, isLoading, mutate } = useSWR<UserStats>(
    '/api/progress/stats',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // 30 seconds
    }
  );

  const { trigger: buyFreeze, isMutating: isBuyingFreeze } = useSWRMutation(
    '/api/shop/buy-freeze',
    buyFreezeFetcher,
    {
      onSuccess: (response) => {
        if (response.success && response.data) {
          // Optimistically update the cache
          mutate(
            (current) =>
              current
                ? {
                    ...current,
                    xp: response.data!.xp,
                    streakFreezeCount: response.data!.streakFreezeCount,
                  }
                : current,
            { revalidate: false }
          );
        }
      },
    }
  );

  return {
    stats: data,
    isLoading,
    error,
    buyFreeze,
    isBuyingFreeze,
    mutateStats: mutate,
  };
}
