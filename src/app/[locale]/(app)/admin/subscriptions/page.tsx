'use client';

import { useEffect, useReducer } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AdminSubscriptionsPageSkeleton } from '@/components/admin/AdminLoadingSkeletons';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import { Button } from '@/components/ui/Button';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import { HiOutlineEye, HiOutlineSearch } from 'react-icons/hi';
import {
  fetchAdminSubscriptionsViewModel,
  updateAdminSubscriptionStatus,
} from '@/features/admin/subscriptions/api/admin-subscriptions-api';
import type {
  AdminMutableSubscriptionStatusViewModel,
  AdminSubscriptionStatusViewModel,
  AdminSubscriptionViewModel,
  AdminSubscriptionsPaginationViewModel,
} from '@/features/admin/subscriptions/types/admin-subscriptions-view-model';

const STATUS_OPTIONS: AdminSubscriptionStatusViewModel[] = [
  'pending',
  'completed',
  'failed',
  'cancelled',
  'expired',
];

interface AdminSubscriptionsState {
  status: 'loading' | 'ready';
  subscriptions: AdminSubscriptionViewModel[];
  actionLoading: string | null;
  error: string;
  success: string;
  searchInput: string;
  searchTerm: string;
  statusFilter: '' | AdminSubscriptionStatusViewModel;
  pagination: AdminSubscriptionsPaginationViewModel;
  selectedSubscription: AdminSubscriptionViewModel | null;
}

type AdminSubscriptionsAction =
  | { type: 'patch'; value: Partial<AdminSubscriptionsState> }
  | {
      type: 'loadSuccess';
      value: {
        subscriptions: AdminSubscriptionViewModel[];
        pagination: AdminSubscriptionsPaginationViewModel;
      };
    }
  | {
      type: 'updateStatus';
      subscriptionId: string;
      status: AdminMutableSubscriptionStatusViewModel;
    };

const initialPagination: AdminSubscriptionsPaginationViewModel = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
};

const initialState: AdminSubscriptionsState = {
  status: 'loading',
  subscriptions: [],
  actionLoading: null,
  error: '',
  success: '',
  searchInput: '',
  searchTerm: '',
  statusFilter: '',
  pagination: initialPagination,
  selectedSubscription: null,
};

interface SubscriptionSearchBarProps {
  searchTerm: string;
  statusFilter: string;
  searchLabel: string;
  clearLabel: string;
  searchPlaceholder: string;
  onSearchTermChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onClear: () => void;
}

interface SubscriptionStatusFiltersProps {
  currentFilter: '' | AdminSubscriptionStatusViewModel;
  onChange: (value: '' | AdminSubscriptionStatusViewModel) => void;
}

interface SubscriptionsTableProps {
  subscriptions: AdminSubscriptionViewModel[];
  pagination: AdminSubscriptionsPaginationViewModel;
  noResultsLabel: string;
  loadingLabel: string;
  onViewDetails: (subscription: AdminSubscriptionViewModel) => void;
}

interface SubscriptionDetailModalProps {
  subscription: AdminSubscriptionViewModel | null;
  actionLoadingId: string | null;
  onClose: () => void;
  onUpdateStatus: (subscriptionId: string, status: AdminMutableSubscriptionStatusViewModel) => void;
}

interface SubscriptionDetailFieldProps {
  label: string;
  value: ReactNode;
}

function adminSubscriptionsReducer(
  state: AdminSubscriptionsState,
  action: AdminSubscriptionsAction,
): AdminSubscriptionsState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.value };
    case 'loadSuccess':
      return {
        ...state,
        status: 'ready',
        subscriptions: action.value.subscriptions,
        pagination: action.value.pagination,
        error: '',
      };
    case 'updateStatus': {
      const subscriptions = state.subscriptions.map((subscription) =>
        subscription.id === action.subscriptionId
          ? { ...subscription, status: action.status, isActive: false }
          : subscription,
      );
      const selectedSubscription =
        state.selectedSubscription?.id === action.subscriptionId
          ? { ...state.selectedSubscription, status: action.status, isActive: false }
          : state.selectedSubscription;

      return {
        ...state,
        subscriptions,
        selectedSubscription,
      };
    }
    default:
      return state;
  }
}

function getStatusBadge(status: AdminSubscriptionStatusViewModel) {
  switch (status) {
    case 'completed':
      return <Badge variant="success">{status}</Badge>;
    case 'pending':
      return <Badge variant="warning">{status}</Badge>;
    case 'cancelled':
    case 'failed':
      return <Badge variant="danger">{status}</Badge>;
    case 'expired':
      return <Badge variant="default">{status}</Badge>;
  }
}

function getTypeBadge(type: string) {
  switch (type) {
    case 'yearly':
      return <Badge variant="success">{type}</Badge>;
    case 'monthly':
      return <Badge variant="info">{type}</Badge>;
    default:
      return <Badge variant="default">{type}</Badge>;
  }
}

function getAvailableStatusTransitions(
  subscription: AdminSubscriptionViewModel,
): AdminMutableSubscriptionStatusViewModel[] {
  if (subscription.status === 'pending') return ['failed', 'cancelled'];
  if (subscription.status === 'completed') {
    return subscription.endDate ? ['cancelled', 'expired'] : ['cancelled'];
  }
  return [];
}

function SubscriptionSearchBar({
  searchTerm,
  statusFilter,
  searchLabel,
  clearLabel,
  searchPlaceholder,
  onSearchTermChange,
  onSubmit,
  onClear,
}: SubscriptionSearchBarProps) {
  return (
    <form onSubmit={onSubmit} className="mb-4 flex gap-4">
      <div className="max-w-md flex-1">
        <Input
          type="text"
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          className="w-full"
        />
      </div>
      <Button type="submit" variant="gradient">
        <HiOutlineSearch className="mr-2 size-4" />
        {searchLabel}
      </Button>
      {searchTerm || statusFilter ? (
        <Button type="button" variant="outline" onClick={onClear}>
          {clearLabel}
        </Button>
      ) : null}
    </form>
  );
}

function SubscriptionStatusFilters({ currentFilter, onChange }: SubscriptionStatusFiltersProps) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      <Button
        onClick={() => onChange('')}
        variant="ghost"
        className={`min-h-[40px] rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
          !currentFilter
            ? 'border border-green-200 bg-green-100 text-brand-trust'
            : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
        }`}
      >
        All Subscriptions
      </Button>
      {STATUS_OPTIONS.map((status) => (
        <Button
          key={status}
          onClick={() => onChange(status)}
          variant="ghost"
          className={`min-h-[40px] rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
            currentFilter === status
              ? 'border border-green-200 bg-green-100 text-brand-trust'
              : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
          }`}
        >
          {status}
        </Button>
      ))}
    </div>
  );
}

function SubscriptionsTable({
  subscriptions,
  pagination,
  noResultsLabel,
  loadingLabel,
  onViewDetails,
}: SubscriptionsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscriptions</CardTitle>
        <CardDescription>
          {pagination.total > 0
            ? `Showing ${(pagination.page - 1) * pagination.limit + 1} to ${Math.min(
                pagination.page * pagination.limit,
                pagination.total,
              )} of ${pagination.total} subscriptions`
            : 'No subscriptions found'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {subscriptions.length === 0 ? (
          <EmptyState
            title={noResultsLabel}
            description="Try adjusting the current search or status filter."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase text-neutral-700">
                <tr>
                  <th scope="col" className="px-6 py-3">
                    User
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Amount
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Start Date
                  </th>
                  <th scope="col" className="px-6 py-3">
                    End Date
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((subscription) => (
                  <tr key={subscription.id} className="border-b bg-white hover:bg-neutral-50">
                    <td className="px-6 py-4 font-medium text-neutral-900">
                      {subscription.userEmail}
                    </td>
                    <td className="px-6 py-4">{getTypeBadge(subscription.type)}</td>
                    <td className="px-6 py-4">{subscription.amountLabel}</td>
                    <td className="px-6 py-4">{getStatusBadge(subscription.status)}</td>
                    <td className="px-6 py-4 text-neutral-500">{subscription.startDateLabel}</td>
                    <td className="px-6 py-4 text-neutral-500">{subscription.endDateLabel}</td>
                    <td className="px-6 py-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewDetails(subscription)}
                        className="min-h-[40px] px-3 text-brand-trust hover:text-brand-trust"
                      >
                        <HiOutlineEye className="mr-1 size-4" /> View Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {subscriptions.length === 0 ? null : (
          <p className="mt-4 text-sm text-neutral-500">{loadingLabel}</p>
        )}
      </CardContent>
    </Card>
  );
}

function SubscriptionDetailModal({
  subscription,
  actionLoadingId,
  onClose,
  onUpdateStatus,
}: SubscriptionDetailModalProps) {
  const availableTransitions = subscription ? getAvailableStatusTransitions(subscription) : [];

  return (
    <Modal isOpen={!!subscription} onClose={onClose} title="Subscription Details">
      {subscription ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <SubscriptionDetailField label="User Email" value={subscription.userEmail} />
            <SubscriptionDetailField
              label="Subscription Type"
              value={getTypeBadge(subscription.type)}
            />
            <SubscriptionDetailField label="Amount" value={subscription.amountLabel} />
            <SubscriptionDetailField label="Status" value={getStatusBadge(subscription.status)} />
            <SubscriptionDetailField
              label="PayOS Order ID"
              value={<span className="font-mono text-sm">{subscription.payosOrderId}</span>}
            />
            <SubscriptionDetailField
              label="PayOS Transaction ID"
              value={
                <span className="font-mono text-sm">{subscription.payosTransactionIdLabel}</span>
              }
            />
            <SubscriptionDetailField label="Start Date" value={subscription.startDateLabel} />
            <SubscriptionDetailField label="End Date" value={subscription.endDateLabel} />
            <SubscriptionDetailField label="Created At" value={subscription.createdAtLabel} />
            <SubscriptionDetailField label="Updated At" value={subscription.updatedAtLabel} />
          </div>

          {availableTransitions.length > 0 ? (
            <div className="border-t pt-4">
              <p className="mb-3 block text-sm font-medium text-neutral-700">Update Status</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {availableTransitions.map((status) => (
                  <Button
                    key={status}
                    variant="outline"
                    size="sm"
                    disabled={actionLoadingId === subscription.id}
                    onClick={() => onUpdateStatus(subscription.id, status)}
                    className="min-h-[40px] w-full justify-center px-3 text-sm font-medium capitalize"
                  >
                    {actionLoadingId === subscription.id ? 'Updating…' : `Mark as ${status}`}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

function SubscriptionDetailField({ label, value }: SubscriptionDetailFieldProps) {
  return (
    <div>
      <p className="mb-1 block text-sm font-medium text-neutral-700">{label}</p>
      <div className="text-sm text-neutral-900">{value}</div>
    </div>
  );
}

export default function AdminSubscriptionsPage() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const [state, dispatch] = useReducer(adminSubscriptionsReducer, initialState);

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: 'patch', value: { status: 'loading', success: '' } });

    void fetchAdminSubscriptionsViewModel({
      page: state.pagination.page,
      limit: state.pagination.limit,
      searchTerm: state.searchTerm,
      statusFilter: state.statusFilter,
      signal: controller.signal,
    })
      .then((value) => dispatch({ type: 'loadSuccess', value }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        dispatch({
          type: 'patch',
          value: {
            status: 'ready',
            error: error instanceof Error ? error.message : 'Failed to fetch subscriptions',
          },
        });
      });

    return () => controller.abort();
  }, [state.pagination.limit, state.pagination.page, state.searchTerm, state.statusFilter]);

  const setSearchInput = (searchInput: string) => {
    dispatch({
      type: 'patch',
      value: { searchInput },
    });
  };

  const setStatusFilter = (statusFilter: '' | AdminSubscriptionStatusViewModel) => {
    dispatch({
      type: 'patch',
      value: {
        statusFilter,
        pagination: { ...state.pagination, page: 1 },
      },
    });
  };

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    dispatch({
      type: 'patch',
      value: {
        searchTerm: state.searchInput.trim(),
        pagination: { ...state.pagination, page: 1 },
        success: '',
      },
    });
  };

  const handlePageChange = (page: number) => {
    dispatch({
      type: 'patch',
      value: {
        pagination: { ...state.pagination, page },
        success: '',
      },
    });
  };

  const handleClearFilters = () => {
    dispatch({
      type: 'patch',
      value: {
        searchInput: '',
        searchTerm: '',
        statusFilter: '',
        success: '',
        pagination: { ...state.pagination, page: 1 },
      },
    });
  };

  const handleUpdateStatus = async (
    subscriptionId: string,
    status: AdminMutableSubscriptionStatusViewModel,
  ) => {
    dispatch({ type: 'patch', value: { actionLoading: subscriptionId } });
    try {
      await updateAdminSubscriptionStatus({ subscriptionId, status });
      dispatch({ type: 'updateStatus', subscriptionId, status });
      dispatch({
        type: 'patch',
        value: {
          success: `Subscription status updated to ${status}`,
          selectedSubscription: null,
        },
      });
    } catch (error) {
      dispatch({
        type: 'patch',
        value: {
          error: error instanceof Error ? error.message : 'Failed to update subscription',
        },
      });
    }
    dispatch({ type: 'patch', value: { actionLoading: null } });
  };

  return (
    <AdminPageShell>
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader
          title={t('subscriptions')}
          description="Manage user subscriptions and payment statuses"
        />

        <SubscriptionSearchBar
          searchTerm={state.searchInput}
          statusFilter={state.statusFilter}
          searchLabel={tCommon('search')}
          clearLabel={tCommon('clear')}
          searchPlaceholder={t('searchByEmailPlaceholder')}
          onSearchTermChange={setSearchInput}
          onSubmit={handleSearch}
          onClear={handleClearFilters}
        />

        <SubscriptionStatusFilters currentFilter={state.statusFilter} onChange={setStatusFilter} />

        {state.error ? <ErrorState message={state.error} className="mb-6" /> : null}
        {state.success ? (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">
            {state.success}
          </div>
        ) : null}

        {state.status === 'loading' ? (
          <AdminSubscriptionsPageSkeleton />
        ) : (
          <>
            <SubscriptionsTable
              subscriptions={state.subscriptions}
              pagination={state.pagination}
              noResultsLabel={t('noUsersFound')}
              loadingLabel={t('loadingStatistics')}
              onViewDetails={(subscription) =>
                dispatch({ type: 'patch', value: { selectedSubscription: subscription } })
              }
            />

            {state.pagination.totalPages > 1 ? (
              <div className="mt-6">
                <Pagination
                  currentPage={state.pagination.page}
                  totalPages={state.pagination.totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            ) : null}
          </>
        )}

        <SubscriptionDetailModal
          subscription={state.selectedSubscription}
          actionLoadingId={state.actionLoading}
          onClose={() => dispatch({ type: 'patch', value: { selectedSubscription: null } })}
          onUpdateStatus={(subscriptionId, status) =>
            void handleUpdateStatus(subscriptionId, status)
          }
        />
      </div>
    </AdminPageShell>
  );
}
