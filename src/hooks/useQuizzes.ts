'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';

interface Quiz {
  _id: string;
  title: string;
  description: string;
  slug: string;
  category: {
    name: string;
    color: string;
  };
  author: {
    email: string;
  };
  createdAt: string;
  questions: Array<unknown>;
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

  const query = params.toString();
  const url = query ? `/api/quizzes?${query}` : '/api/quizzes';

  const { data, error, isLoading, mutate } = useSWR<QuizzesResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
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
