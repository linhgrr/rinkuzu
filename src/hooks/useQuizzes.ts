'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';

export interface Quiz {
  _id: string;
  title: string;
  description: string;
  slug: string;
  category?: {
    _id?: string;
    name: string;
    color: string;
  } | null;
  author?: {
    _id?: string;
    email: string;
  } | null;
  createdAt: string;
  questions: Array<unknown>;
  questionCount?: number;
}

interface QuizzesResponse {
  success: boolean;
  data: {
    quizzes: Quiz[];
    pagination: {
      total: number;
    };
  };
}

interface UseQuizzesOptions {
  limit?: number;
  status?: 'pending' | 'published' | 'rejected';
  mine?: boolean;
  compact?: boolean;
  fallbackQuizzes?: Quiz[];
  fallbackTotal?: number;
}

export function useQuizzes(options: UseQuizzesOptions = {}) {
  const params = new URLSearchParams();

  if (typeof options.limit === 'number') {
    params.set('limit', String(options.limit));
  }
  if (options.status) {
    params.set('status', options.status);
  }
  if (options.mine) {
    params.set('mine', 'true');
  }
  if (options.compact) {
    params.set('compact', 'true');
  }

  const query = params.toString();
  const url = query ? `/api/quizzes?${query}` : '/api/quizzes';

  const fallbackData =
    options.fallbackQuizzes
      ? {
        success: true,
        data: {
          quizzes: options.fallbackQuizzes,
          pagination: {
            total: options.fallbackTotal ?? options.fallbackQuizzes.length,
          },
        },
      }
      : undefined;

  const { data, error, isLoading, mutate } = useSWR<QuizzesResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
      fallbackData,
    }
  );

  return {
    quizzes: data?.data?.quizzes ?? [],
    total: data?.data?.pagination?.total ?? 0,
    isLoading,
    error,
    mutateQuizzes: mutate,
  };
}
