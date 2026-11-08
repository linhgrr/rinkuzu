'use client';

import { useEffect, useReducer } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  fetchAdminStarterQuizzes,
  markStarterQuiz,
  unmarkStarterQuiz,
  updateStarterQuiz,
} from '@/features/admin/quizzes/api/admin-quizzes-api';
import { moveStarterQuiz } from '@/features/admin/quizzes/mappers/admin-starter-quizzes.mapper';
import type {
  AdminStarterQuizDropReason,
  AdminStarterQuizLocale,
  AdminStarterQuizMarkInput,
  AdminStarterQuizViewModel,
} from '@/features/admin/quizzes/types/admin-starter-quizzes-view-model';
import { useReloadSettled } from '@/features/admin/hooks/useReloadSettled';
import { ApiResponseError } from '@/lib/api/client';
import { useAdminApiErrorMessage } from '@/lib/api/use-api-error';

export interface StarterMarkTarget {
  quizId: string;
  title: string;
}

interface State {
  items: readonly AdminStarterQuizViewModel[];
  loading: boolean;
  /** Kept while a retry runs, so Retry stays pending with no skeleton flash (RIN-1166). */
  loadError: unknown;
  reloadToken: number;
  /** The starter id (or `mark`) whose write is in flight; every control waits on it. */
  pendingId: string | null;
  markTarget: StarterMarkTarget | null;
  /** Inline copy for the mark dialog: the API's 409/422 in words. */
  markError: string;
}

type Action =
  | { type: 'loaded'; items: readonly AdminStarterQuizViewModel[] }
  | { type: 'loadFailed'; error: unknown }
  | { type: 'reload' }
  | { type: 'writeStarted'; pendingId: string; items?: readonly AdminStarterQuizViewModel[] }
  | { type: 'writeSettled'; items: readonly AdminStarterQuizViewModel[] }
  | { type: 'markOpened'; target: StarterMarkTarget | null }
  | { type: 'markFailed'; message: string };

const initialState: State = {
  items: [],
  loading: true,
  loadError: null,
  reloadToken: 0,
  pendingId: null,
  markTarget: null,
  markError: '',
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loaded':
      return { ...state, items: action.items, loading: false, loadError: null };
    case 'loadFailed':
      return { ...state, loading: false, loadError: action.error };
    case 'reload':
      return { ...state, reloadToken: state.reloadToken + 1 };
    case 'writeStarted':
      return { ...state, pendingId: action.pendingId, items: action.items ?? state.items };
    case 'writeSettled':
      return { ...state, pendingId: null, items: action.items };
    case 'markOpened':
      return { ...state, markTarget: action.target, markError: '' };
    case 'markFailed':
      return { ...state, pendingId: null, markError: action.message };
    default:
      return state;
  }
}

type WriteResult = { ok: true; items: AdminStarterQuizViewModel[] } | { ok: false; error: unknown };

async function settleWrite(request: () => Promise<AdminStarterQuizViewModel[]>) {
  try {
    const items = await request();
    return { ok: true, items } satisfies WriteResult;
  } catch (error) {
    return { ok: false, error } satisfies WriteResult;
  }
}

const DROP_REASONS: readonly AdminStarterQuizDropReason[] = [
  'missing',
  'not-public',
  'premium',
  'empty',
];

/** The API's mark refusal as a reason we can put in words: 409 already marked, 422 a drop rule. */
function getStarterMarkRefusal(error: unknown): AdminStarterQuizDropReason | 'starter' | null {
  if (!(error instanceof ApiResponseError)) return null;
  if (error.status === 409) return 'starter';
  if (error.status !== 422) return null;
  return DROP_REASONS.find((reason) => error.message.endsWith(`: ${reason}`)) ?? null;
}

export const STARTER_DROP_REASON_KEYS = {
  missing: 'dropMissing',
  'not-public': 'dropNotPublic',
  premium: 'dropPremium',
  empty: 'dropEmpty',
} as const satisfies Record<AdminStarterQuizDropReason, string>;

export interface AdminStarterQuizzesController {
  items: readonly AdminStarterQuizViewModel[];
  loading: boolean;
  loadError: unknown;
  pendingId: string | null;
  starterQuizIds: ReadonlySet<string>;
  markTarget: StarterMarkTarget | null;
  markError: string;
  retry: () => Promise<void>;
  move: (starterId: string, position: number) => Promise<void>;
  setLocale: (starterId: string, locale: AdminStarterQuizLocale) => Promise<void>;
  unmark: (starterId: string) => Promise<boolean>;
  openMark: (target: StarterMarkTarget | null) => void;
  mark: (input: AdminStarterQuizMarkInput) => Promise<void>;
}

/** The `/admin/quizzes` starter panel: load, optimistic reorder and locale, unmark, mark. */
export function useAdminStarterQuizzes(): AdminStarterQuizzesController {
  const t = useTranslations('admin.starterQuizzes');
  const describeError = useAdminApiErrorMessage();
  const [state, dispatch] = useReducer(reducer, initialState);
  const { waitForReload, settleReload } = useReloadSettled();

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      try {
        const items = await fetchAdminStarterQuizzes(controller.signal);
        if (cancelled) return;
        dispatch({ type: 'loaded', items });
      } catch (error) {
        if (cancelled) return;
        dispatch({ type: 'loadFailed', error });
      }
      settleReload();
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [state.reloadToken, settleReload]);

  /** Shows `optimistic` at once; on failure puts the list back and says so in a toast. */
  async function write(
    starterId: string,
    optimistic: readonly AdminStarterQuizViewModel[],
    request: () => Promise<AdminStarterQuizViewModel[]>,
    fallback: string,
  ): Promise<boolean> {
    const previous = state.items;
    dispatch({ type: 'writeStarted', pendingId: starterId, items: optimistic });
    const result = await settleWrite(request);
    if (result.ok) {
      dispatch({ type: 'writeSettled', items: result.items });
      return true;
    }
    dispatch({ type: 'writeSettled', items: previous });
    toast.error(describeError(result.error, fallback));
    return false;
  }

  async function move(starterId: string, position: number) {
    await write(
      starterId,
      moveStarterQuiz(state.items, starterId, position),
      () => updateStarterQuiz(starterId, { order: position }),
      t('moveError'),
    );
  }

  async function setLocale(starterId: string, locale: AdminStarterQuizLocale) {
    await write(
      starterId,
      state.items.map((item) => (item.id === starterId ? { ...item, locale } : item)),
      () => updateStarterQuiz(starterId, { locale }),
      t('localeError'),
    );
  }

  async function unmark(starterId: string) {
    const unmarked = await write(
      starterId,
      state.items,
      () => unmarkStarterQuiz(starterId),
      t('unmarkError'),
    );
    if (unmarked) toast.success(t('unmarked'));
    return unmarked;
  }

  async function mark(input: AdminStarterQuizMarkInput) {
    dispatch({ type: 'writeStarted', pendingId: 'mark' });
    const result = await settleWrite(() => markStarterQuiz(input));
    if (result.ok) {
      dispatch({ type: 'writeSettled', items: result.items });
      dispatch({ type: 'markOpened', target: null });
      toast.success(t('marked'));
      return;
    }
    const refusal = getStarterMarkRefusal(result.error);
    const message =
      refusal === 'starter'
        ? t('markRefusedStarter')
        : refusal
          ? t('markRefused', { reason: t(STARTER_DROP_REASON_KEYS[refusal]) })
          : describeError(result.error, t('markError'));
    dispatch({ type: 'markFailed', message });
  }

  return {
    items: state.items,
    loading: state.loading,
    loadError: state.loadError,
    pendingId: state.pendingId,
    starterQuizIds: new Set(state.items.map(({ quizId }) => quizId)),
    markTarget: state.markTarget,
    markError: state.markError,
    retry: () => {
      dispatch({ type: 'reload' });
      return waitForReload();
    },
    move,
    setLocale,
    unmark,
    openMark: (target) => dispatch({ type: 'markOpened', target }),
    mark,
  };
}
