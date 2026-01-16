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
    total: number;
  };
}

export function useQuizzes(limit?: number) {
  const url = limit ? `/api/quizzes?limit=${limit}` : '/api/quizzes';

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
    total: data?.data?.total ?? 0,
    isLoading,
    error,
    mutateQuizzes: mutate,
  };
}
