'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { fetchProfileQuizLibraryPage } from '@/features/profile/api/profile-quizzes-api';
import {
  fetchMyPremiumSubmissions,
  type ProfilePremiumSubmission,
} from '@/features/profile/api/premium-submissions-api';
import type {
  ProfileQuizLibraryCounts,
  ProfileQuizLibraryViewModel,
  ProfileQuizViewModel,
} from '@/features/profile/types/profile-quiz-view-model';
import type { QuizLibraryFilter } from '@/lib/quiz/library';

/** Debounce for the /my-quizzes search box (RIN-1206). */
const PROFILE_QUIZ_SEARCH_DEBOUNCE_MS = 300;

type LibraryPhase = 'loading' | 'loading-more' | 'idle';

interface LibraryState {
  quizzes: ProfileQuizViewModel[];
  /** Null until the first page arrives: the skeleton shows instead of stale cards. */
  counts: ProfileQuizLibraryCounts | null;
  page: number;
  hasMore: boolean;
  phase: LibraryPhase;
  /** First-page failure for the current filter and search. */
  error: unknown;
  /** Load more failure; the loaded cards stay. */
  loadMoreError: unknown;
}

type LibraryAction =
  | { type: 'reset:start' }
  | { type: 'reset:success'; result: ProfileQuizLibraryViewModel }
  | { type: 'reset:error'; error: unknown }
  | { type: 'more:start' }
  | { type: 'more:success'; result: ProfileQuizLibraryViewModel }
  | { type: 'more:error'; error: unknown }
  | { type: 'quiz:removed'; quiz: ProfileQuizViewModel };

const initialState: LibraryState = {
  quizzes: [],
  counts: null,
  page: 1,
  hasMore: false,
  phase: 'loading',
  error: null,
  loadMoreError: null,
};

function decrementCounts(
  counts: ProfileQuizLibraryCounts | null,
  quiz: ProfileQuizViewModel,
): ProfileQuizLibraryCounts | null {
  if (!counts) return counts;
  return {
    all: Math.max(0, counts.all - 1),
    inProgress: counts.inProgress - (quiz.libraryStatus === 'in_progress' ? 1 : 0),
    complete: counts.complete - (quiz.libraryStatus === 'complete' ? 1 : 0),
  };
}

function reducer(state: LibraryState, action: LibraryAction): LibraryState {
  switch (action.type) {
    case 'reset:start':
      return { ...state, phase: 'loading', error: null, loadMoreError: null };
    case 'reset:success':
      return {
        ...state,
        quizzes: action.result.quizzes,
        counts: action.result.counts,
        page: 1,
        hasMore: action.result.hasMore,
        phase: 'idle',
      };
    case 'reset:error':
      return { ...state, phase: 'idle', error: action.error };
    case 'more:start':
      return { ...state, phase: 'loading-more', loadMoreError: null };
    case 'more:success':
      return {
        ...state,
        quizzes: [...state.quizzes, ...action.result.quizzes],
        counts: action.result.counts,
        page: state.page + 1,
        hasMore: action.result.hasMore,
        phase: 'idle',
      };
    case 'more:error':
      return { ...state, phase: 'idle', loadMoreError: action.error };
    case 'quiz:removed':
      return {
        ...state,
        quizzes: state.quizzes.filter((quiz) => quiz.id !== action.quiz.id),
        counts: decrementCounts(state.counts, action.quiz),
      };
    default:
      return state;
  }
}

type SubmissionsByQuiz = Map<string, ProfilePremiumSubmission>;

async function fetchLatestSubmissionsByQuiz(): Promise<SubmissionsByQuiz> {
  const submissions = await fetchMyPremiumSubmissions();
  return new Map(
    submissions
      .toSorted((left, right) => left.version - right.version)
      .map((submission) => [submission.sourceQuizId, submission]),
  );
}

function withSubmissions(
  result: ProfileQuizLibraryViewModel,
  latestByQuiz: SubmissionsByQuiz,
): ProfileQuizLibraryViewModel {
  return {
    ...result,
    quizzes: result.quizzes.map((quiz) => {
      const submission = latestByQuiz.get(quiz.id);
      return submission
        ? {
            ...quiz,
            premiumSubmissionStatus: submission.status,
            awardedCredits: submission.awardedCredits,
          }
        : quiz;
    }),
  };
}

/**
 * Server-filtered, paged /my-quizzes library (RIN-1206): the status filter and the debounced
 * search go to GET /api/library; a new filter or search restarts at page 1, and a response for an
 * older filter or search is dropped.
 */
export function useProfileQuizLibrary() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [filter, setFilter] = useState<QuizLibraryFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  /** Bumped by every first-page request; responses carrying an older value are stale. */
  const generationRef = useRef(0);
  const submissionsRef = useRef<Promise<SubmissionsByQuiz> | null>(null);

  const loadPage = useCallback(async (page: number, status: QuizLibraryFilter, q: string) => {
    // Premium submissions load once; a failed load is forgotten so Retry asks again.
    submissionsRef.current ??= fetchLatestSubmissionsByQuiz().catch((error: unknown) => {
      submissionsRef.current = null;
      throw error;
    });
    const [result, latestByQuiz] = await Promise.all([
      fetchProfileQuizLibraryPage({ page, status, q }),
      submissionsRef.current,
    ]);
    return withSubmissions(result, latestByQuiz);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput.trim()), PROFILE_QUIZ_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    dispatch({ type: 'reset:start' });
    loadPage(1, filter, query).then(
      (result) => {
        if (generation === generationRef.current) dispatch({ type: 'reset:success', result });
      },
      (error: unknown) => {
        if (generation === generationRef.current) dispatch({ type: 'reset:error', error });
      },
    );
  }, [filter, query, reloadKey, loadPage]);

  function loadMore() {
    const generation = generationRef.current;
    dispatch({ type: 'more:start' });
    loadPage(state.page + 1, filter, query).then(
      (result) => {
        if (generation === generationRef.current) dispatch({ type: 'more:success', result });
      },
      (error: unknown) => {
        if (generation === generationRef.current) dispatch({ type: 'more:error', error });
      },
    );
  }

  function clearSearch() {
    setSearchInput('');
    setQuery('');
  }

  return {
    ...state,
    filter,
    setFilter,
    searchInput,
    setSearchInput,
    query,
    clearSearch,
    loadMore,
    retry: () => setReloadKey((key) => key + 1),
    removeQuiz: (quiz: ProfileQuizViewModel) => dispatch({ type: 'quiz:removed', quiz }),
  };
}
