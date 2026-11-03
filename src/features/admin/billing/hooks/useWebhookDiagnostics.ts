'use client';

import { useCallback, useEffect, useReducer } from 'react';
import { fetchAdminWebhookDiagnostics } from '@/features/admin/billing/api/admin-billing-api';
import type {
  AdminBillingPaginationViewModel,
  AdminWebhookDiagnosticViewModel,
} from '@/features/admin/billing/types/admin-billing-view-model';
import { useAdminApiErrorMessage } from '@/lib/api/use-api-error';

interface DiagnosticsState {
  webhooks: AdminWebhookDiagnosticViewModel[];
  pagination: AdminBillingPaginationViewModel;
  /** Empty means every verification class. */
  verificationClass: string;
  loading: boolean;
  error: string;
  reloadToken: number;
}

const INITIAL_STATE: DiagnosticsState = {
  webhooks: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  verificationClass: '',
  loading: false,
  error: '',
  reloadToken: 0,
};

type DiagnosticsAction =
  | { type: 'patch'; value: Partial<DiagnosticsState> }
  | { type: 'filter'; value: string }
  | { type: 'page'; value: number };

function reducer(state: DiagnosticsState, action: DiagnosticsAction): DiagnosticsState {
  // Changing the filter and going back to the first page is one transition,
  // not two: the second render of a half-applied pair would fetch page five of
  // a list that no longer has five pages.
  if (action.type === 'filter') {
    return {
      ...state,
      verificationClass: action.value,
      pagination: { ...state.pagination, page: 1 },
    };
  }
  if (action.type === 'page') {
    return { ...state, pagination: { ...state.pagination, page: action.value } };
  }
  return { ...state, ...action.value };
}

export interface UseWebhookDiagnostics {
  webhooks: AdminWebhookDiagnosticViewModel[];
  pagination: AdminBillingPaginationViewModel;
  verificationClass: string;
  loading: boolean;
  error: string;
  setVerificationClass: (value: string) => void;
  setPage: (page: number) => void;
  reload: () => void;
}

/**
 * The webhook door's own record.
 *
 * Loaded only once the tab is opened, because it is a second paginated query
 * and the page an operator lands on is about orders. A replay changes what the
 * list says, so `reload` is exposed rather than the panel guessing.
 *
 * State moves through a reducer for the same reason its sibling hook does: one
 * dispatch per transition keeps a load, a failure and a filter change from
 * being three separate renders that can be observed half-applied.
 */
export function useWebhookDiagnostics(active: boolean): UseWebhookDiagnostics {
  const describeError = useAdminApiErrorMessage();
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const { verificationClass, reloadToken, pagination } = state;
  const { page, limit } = pagination;

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    dispatch({ type: 'patch', value: { loading: true, error: '' } });

    void fetchAdminWebhookDiagnostics({
      page,
      limit,
      verificationClass,
      signal: controller.signal,
    })
      .then((result) =>
        dispatch({
          type: 'patch',
          value: { webhooks: result.webhooks, pagination: result.pagination, loading: false },
        }),
      )
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        dispatch({
          type: 'patch',
          value: {
            loading: false,
            error: describeError(caught),
          },
        });
      });

    return () => controller.abort();
  }, [active, page, limit, verificationClass, reloadToken, describeError]);

  return {
    webhooks: state.webhooks,
    pagination: state.pagination,
    verificationClass: state.verificationClass,
    loading: state.loading,
    error: state.error,
    setVerificationClass: useCallback((value: string) => {
      dispatch({ type: 'filter', value });
    }, []),
    setPage: useCallback((next: number) => {
      dispatch({ type: 'page', value: next });
    }, []),
    reload: useCallback(() => {
      dispatch({ type: 'patch', value: { reloadToken: Date.now() } });
    }, []),
  };
}
