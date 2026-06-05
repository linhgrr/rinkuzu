'use client';

import { useCallback, useEffect, useReducer } from 'react';
import { useTranslations } from 'next-intl';
import { fetchApiData } from '@/lib/api/client';
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
import { LoadingState } from '@/components/ui/LoadingState';
import { Modal } from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import { HiOutlineEye, HiOutlineSearch } from '@/components/icons';

const vndCurrencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const STATUS_OPTIONS = ['pending', 'completed', 'cancelled', 'expired'] as const;

interface Subscription {
  _id: string;
  userEmail: string;
  user: string;
  type: 'monthly' | 'yearly' | 'lifetime';
  amount: number;
  status: 'pending' | 'completed' | 'cancelled' | 'expired';
  payosOrderId: string;
  payosTransactionId?: string;
  startDate: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AdminSubscriptionsState {
  status: 'loading' | 'ready';
  subscriptions: Subscription[];
  actionLoading: string | null;
  error: string;
  success: string;
  searchTerm: string;
  statusFilter: '' | Subscription['status'];
  pagination: PaginationData;
  selectedSubscription: Subscription | null;
}

type AdminSubscriptionsAction =
  | { type: 'patch'; value: Partial<AdminSubscriptionsState> }
  | {
      type: 'loadSuccess';
      value: {
        subscriptions: Subscription[];
        pagination: PaginationData;
      };
    }
  | { type: 'updateStatus'; subscriptionId: string; status: Subscription['status'] };

const initialPagination: PaginationData = {
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
  searchTerm: '',
  statusFilter: '',
  pagination: initialPagination,
  selectedSubscription: null,
};

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
        subscription._id === action.subscriptionId
          ? { ...subscription, status: action.status }
          : subscription,
      );
      const selectedSubscription =
        state.selectedSubscription?._id === action.subscriptionId
          ? { ...state.selectedSubscription, status: action.status }
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

function formatDate(dateString: string) {
  return dateTimeFormatter.format(new Date(dateString));
}

function formatCurrency(amount: number) {
  return vndCurrencyFormatter.format(amount);
}

function getStatusBadge(status: Subscription['status']) {
  switch (status) {
    case 'completed':
      return <Badge variant="success">{status}</Badge>;
    case 'pending':
      return <Badge variant="warning">{status}</Badge>;
    case 'cancelled':
      return <Badge variant="danger">{status}</Badge>;
    case 'expired':
      return <Badge variant="default">{status}</Badge>;
    default:
      return <Badge variant="default">{status}</Badge>;
  }
}

function getTypeBadge(type: Subscription['type']) {
  switch (type) {
    case 'lifetime':
    case 'yearly':
      return <Badge variant="success">{type}</Badge>;
    case 'monthly':
      return <Badge variant="info">{type}</Badge>;
    default:
      return <Badge variant="default">{type}</Badge>;
  }
}

function SubscriptionsHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-semibold text-neutral-900">{title}</h1>
      <p className="mt-2 text-neutral-600">{description}</p>
    </div>
  );
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
}: {
  searchTerm: string;
  statusFilter: string;
  searchLabel: string;
  clearLabel: string;
  searchPlaceholder: string;
  onSearchTermChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onClear: () => void;
}) {
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

function SubscriptionStatusFilters({
  currentFilter,
  onChange,
}: {
  currentFilter: '' | Subscription['status'];
  onChange: (value: '' | Subscription['status']) => void;
}) {
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
}: {
  subscriptions: Subscription[];
  pagination: PaginationData;
  noResultsLabel: string;
  loadingLabel: string;
  onViewDetails: (subscription: Subscription) => void;
}) {
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
                  <tr key={subscription._id} className="border-b bg-white hover:bg-neutral-50">
                    <td className="px-6 py-4 font-medium text-neutral-900">
                      {subscription.userEmail}
                    </td>
                    <td className="px-6 py-4">{getTypeBadge(subscription.type)}</td>
                    <td className="px-6 py-4">{formatCurrency(subscription.amount)}</td>
                    <td className="px-6 py-4">{getStatusBadge(subscription.status)}</td>
                    <td className="px-6 py-4 text-neutral-500">
                      {formatDate(subscription.startDate)}
                    </td>
                    <td className="px-6 py-4 text-neutral-500">
                      {subscription.endDate ? formatDate(subscription.endDate) : 'N/A'}
                    </td>
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
}: {
  subscription: Subscription | null;
  actionLoadingId: string | null;
  onClose: () => void;
  onUpdateStatus: (subscriptionId: string, status: Subscription['status']) => void;
}) {
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
            <SubscriptionDetailField label="Amount" value={formatCurrency(subscription.amount)} />
            <SubscriptionDetailField label="Status" value={getStatusBadge(subscription.status)} />
            <SubscriptionDetailField
              label="PayOS Order ID"
              value={<span className="font-mono text-sm">{subscription.payosOrderId}</span>}
            />
            <SubscriptionDetailField
              label="PayOS Transaction ID"
              value={
                <span className="font-mono text-sm">
                  {subscription.payosTransactionId || 'N/A'}
                </span>
              }
            />
            <SubscriptionDetailField
              label="Start Date"
              value={formatDate(subscription.startDate)}
            />
            <SubscriptionDetailField
              label="End Date"
              value={subscription.endDate ? formatDate(subscription.endDate) : 'Lifetime'}
            />
            <SubscriptionDetailField
              label="Created At"
              value={formatDate(subscription.createdAt)}
            />
            <SubscriptionDetailField
              label="Updated At"
              value={formatDate(subscription.updatedAt)}
            />
          </div>

          <div className="border-t pt-4">
            <p className="mb-3 block text-sm font-medium text-neutral-700">Update Status</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(['completed', 'cancelled', 'expired'] as const).map((status) => (
                <Button
                  key={status}
                  variant="outline"
                  size="sm"
                  disabled={subscription.status === status || actionLoadingId === subscription._id}
                  onClick={() => onUpdateStatus(subscription._id, status)}
                  className={`min-h-[40px] w-full justify-center px-3 text-sm font-medium capitalize ${
                    subscription.status === status ? 'cursor-not-allowed opacity-50' : ''
                  }`}
                >
                  {actionLoadingId === subscription._id ? 'Updating…' : `Mark as ${status}`}
                </Button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function SubscriptionDetailField({ label, value }: { label: string; value: React.ReactNode }) {
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

  const loadSubscriptions = useCallback(
    async (page: number, searchTerm: string, statusFilter: '' | Subscription['status']) => {
      dispatch({ type: 'patch', value: { status: 'loading', success: '' } });
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: state.pagination.limit.toString(),
        });

        if (searchTerm.trim()) {
          params.append('search', searchTerm.trim());
        }

        if (statusFilter) {
          params.append('status', statusFilter);
        }

        const data = await fetchApiData<{
          subscriptions: Subscription[];
          pagination: {
            currentPage: number;
            itemsPerPage: number;
            totalItems: number;
            totalPages: number;
          };
        }>(`/api/admin/subscriptions?${params}`, {
          cache: 'no-store',
        });

        dispatch({
          type: 'loadSuccess',
          value: {
            subscriptions: data.subscriptions,
            pagination: {
              page: data.pagination.currentPage,
              limit: data.pagination.itemsPerPage,
              total: data.pagination.totalItems,
              totalPages: data.pagination.totalPages,
            },
          },
        });
      } catch (error) {
        dispatch({
          type: 'patch',
          value: {
            status: 'ready',
            error: error instanceof Error ? error.message : 'Failed to fetch subscriptions',
          },
        });
      }
    },
    [state.pagination.limit],
  );

  useEffect(() => {
    void loadSubscriptions(state.pagination.page, state.searchTerm, state.statusFilter);
  }, [loadSubscriptions, state.pagination.page, state.searchTerm, state.statusFilter]);

  const setSearchTerm = (searchTerm: string) => {
    dispatch({
      type: 'patch',
      value: {
        searchTerm,
        pagination: { ...state.pagination, page: 1 },
      },
    });
  };

  const setStatusFilter = (statusFilter: '' | Subscription['status']) => {
    dispatch({
      type: 'patch',
      value: {
        statusFilter,
        pagination: { ...state.pagination, page: 1 },
      },
    });
  };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    dispatch({
      type: 'patch',
      value: {
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
        searchTerm: '',
        statusFilter: '',
        success: '',
        pagination: { ...state.pagination, page: 1 },
      },
    });
  };

  const handleUpdateStatus = async (subscriptionId: string, status: Subscription['status']) => {
    dispatch({ type: 'patch', value: { actionLoading: subscriptionId } });
    try {
      await fetchApiData(`/api/admin/subscriptions/${subscriptionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
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
    } finally {
      dispatch({ type: 'patch', value: { actionLoading: null } });
    }
  };

  return (
    <AdminPageShell>
      <div className="mx-auto max-w-6xl">
        <SubscriptionsHeader
          title={t('subscriptions')}
          description="Manage user subscriptions and payment statuses"
        />

        <SubscriptionSearchBar
          searchTerm={state.searchTerm}
          statusFilter={state.statusFilter}
          searchLabel={tCommon('search')}
          clearLabel={tCommon('clear')}
          searchPlaceholder={t('searchByEmailPlaceholder')}
          onSearchTermChange={setSearchTerm}
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
          <LoadingState text={tCommon('loading')} />
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
