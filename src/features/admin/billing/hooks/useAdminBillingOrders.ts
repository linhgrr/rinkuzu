'use client';

import { useCallback, useEffect, useReducer } from 'react';
import {
  fetchAdminBillingOrderDetail,
  fetchAdminBillingOrders,
} from '@/features/admin/billing/api/admin-billing-api';
import { ZERO_BILLING_HEALTH } from '@/features/admin/billing/components/BillingHealthTiles';
import type {
  AdminBillingHealthViewModel,
  AdminBillingOrderDetailViewModel,
  AdminBillingOrderRowViewModel,
  AdminBillingPaginationViewModel,
  AdminOrderBucketViewModel,
} from '@/features/admin/billing/types/admin-billing-view-model';

/**
 * The order list, its filters, and the one order an operator is looking at.
 *
 * All of it lives here rather than in the page because the page had grown into
 * seven hundred lines of state machine and markup in one file, where the only
 * way to see what a button did was to read all of it. The state transitions are
 * the part with rules; the markup is the part without.
 */

interface OrdersState {
  status: 'loading' | 'ready';
  orders: AdminBillingOrderRowViewModel[];
  health: AdminBillingHealthViewModel;
  pagination: AdminBillingPaginationViewModel;
  bucket: AdminOrderBucketViewModel;
  searchInput: string;
  searchTerm: string;
  error: string;
  reloadToken: number;
  detail: AdminBillingOrderDetailViewModel | null;
  detailLoading: boolean;
  detailError: string;
}

interface LoadedOrders {
  orders: AdminBillingOrderRowViewModel[];
  health: AdminBillingHealthViewModel;
  pagination: AdminBillingPaginationViewModel;
}

type OrdersAction =
  | { type: 'patch'; value: Partial<OrdersState> }
  | { type: 'loadSuccess'; value: LoadedOrders };

const INITIAL_STATE: OrdersState = {
  status: 'loading',
  orders: [],
  health: ZERO_BILLING_HEALTH,
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  bucket: 'attention',
  searchInput: '',
  searchTerm: '',
  error: '',
  reloadToken: 0,
  detail: null,
  detailLoading: false,
  detailError: '',
};

function reducer(state: OrdersState, action: OrdersAction): OrdersState {
  if (action.type === 'loadSuccess') {
    return {
      ...state,
      status: 'ready',
      orders: action.value.orders,
      health: action.value.health,
      pagination: action.value.pagination,
      error: '',
    };
  }
  return { ...state, ...action.value };
}

export interface UseAdminBillingOrders extends OrdersState {
  setBucket: (bucket: AdminOrderBucketViewModel) => void;
  setSearchInput: (value: string) => void;
  submitSearch: () => void;
  setPage: (page: number) => void;
  reload: () => void;
  openDetail: (orderId: string) => void;
  closeDetail: () => void;
  /** Re-reads both the open order and the list; money moved, so nothing is guessed. */
  refreshAfterMutation: () => void;
}

export function useAdminBillingOrders(): UseAdminBillingOrders {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const { bucket, searchTerm, reloadToken, pagination, detail } = state;
  const { page, limit } = pagination;

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: 'patch', value: { status: 'loading' } });

    void fetchAdminBillingOrders({ page, limit, bucket, searchTerm, signal: controller.signal })
      .then((value) => dispatch({ type: 'loadSuccess', value }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        dispatch({
          type: 'patch',
          value: {
            status: 'ready',
            error: error instanceof Error ? error.message : 'Failed to load billing orders',
          },
        });
      });

    return () => controller.abort();
  }, [bucket, limit, page, searchTerm, reloadToken]);

  const openDetail = useCallback((orderId: string) => {
    dispatch({ type: 'patch', value: { detailLoading: true, detail: null, detailError: '' } });
    void fetchAdminBillingOrderDetail(orderId)
      .then((loaded) => dispatch({ type: 'patch', value: { detail: loaded } }))
      .catch((error: unknown) =>
        dispatch({
          type: 'patch',
          value: { detailError: error instanceof Error ? error.message : 'Failed to load order' },
        }),
      )
      .finally(() => dispatch({ type: 'patch', value: { detailLoading: false } }));
  }, []);

  const reload = useCallback(() => {
    dispatch({ type: 'patch', value: { reloadToken: Date.now() } });
  }, []);

  return {
    ...state,
    setBucket: (next) =>
      dispatch({
        type: 'patch',
        value: { bucket: next, pagination: { ...pagination, page: 1 } },
      }),
    setSearchInput: (value) => dispatch({ type: 'patch', value: { searchInput: value } }),
    submitSearch: () =>
      dispatch({
        type: 'patch',
        value: {
          searchTerm: state.searchInput.trim(),
          pagination: { ...pagination, page: 1 },
        },
      }),
    setPage: (next) =>
      dispatch({ type: 'patch', value: { pagination: { ...pagination, page: next } } }),
    reload,
    openDetail,
    closeDetail: () => dispatch({ type: 'patch', value: { detail: null, detailError: '' } }),
    refreshAfterMutation: () => {
      if (detail) openDetail(detail.order.id);
      reload();
    },
  };
}
