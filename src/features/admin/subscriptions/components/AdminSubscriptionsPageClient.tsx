'use client';

import { useEffect, useReducer } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AdminSubscriptionsPageSkeleton } from '@/features/admin/components/AdminLoadingSkeletons';
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader';
import { AdminPageShell } from '@/features/admin/components/AdminPageShell';
import { AdminSearchInput } from '@/features/admin/components/AdminSearchInput';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
import { Modal } from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import { HiOutlineEye } from 'react-icons/hi';
import {
  fetchAdminSubscriptionsViewModel,
  revokeAdminSubscription,
} from '@/features/admin/subscriptions/api/admin-subscriptions-api';
import type {
  AdminFilterableSubscriptionStatusViewModel,
  AdminSubscriptionStatusViewModel,
  AdminSubscriptionViewModel,
  AdminSubscriptionsPaginationViewModel,
} from '@/features/admin/subscriptions/types/admin-subscriptions-view-model';
import { DERIVED_SUBSCRIPTION_STATUSES } from '@/shared/constants/subscription-status';
import { useAdminApiErrorMessage } from '@/lib/api/use-api-error';

// Entitlement status is derived from the projection window, so these are the
// only values a row can report — and therefore the only ones worth filtering.
const STATUS_OPTIONS: AdminFilterableSubscriptionStatusViewModel[] = [
  ...DERIVED_SUBSCRIPTION_STATUSES,
];

const REVOKE_CONFIRMATION = 'REVOKE';

interface AdminSubscriptionsState {
  status: 'loading' | 'ready';
  subscriptions: AdminSubscriptionViewModel[];
  actionLoading: string | null;
  error: string;
  success: string;
  searchInput: string;
  searchTerm: string;
  statusFilter: '' | AdminFilterableSubscriptionStatusViewModel;
  pagination: AdminSubscriptionsPaginationViewModel;
  selectedSubscription: AdminSubscriptionViewModel | null;
  revokeReason: string;
  revokeConfirmation: string;
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
  | { type: 'revoked'; subscriptionId: string };

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
  revokeReason: '',
  revokeConfirmation: '',
};

interface SubscriptionSearchBarProps {
  searchTerm: string;
  statusFilter: string;
  clearLabel: string;
  searchPlaceholder: string;
  onSearchTermChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onClear: () => void;
}

interface SubscriptionStatusFiltersProps {
  currentFilter: '' | AdminFilterableSubscriptionStatusViewModel;
  onChange: (value: '' | AdminFilterableSubscriptionStatusViewModel) => void;
}

interface SubscriptionsTableProps {
  subscriptions: AdminSubscriptionViewModel[];
  pagination: AdminSubscriptionsPaginationViewModel;
  noResultsLabel: string;
  onViewDetails: (subscription: AdminSubscriptionViewModel) => void;
}

interface SubscriptionDetailModalProps {
  subscription: AdminSubscriptionViewModel | null;
  actionLoadingId: string | null;
  reason: string;
  confirmation: string;
  onReasonChange: (value: string) => void;
  onConfirmationChange: (value: string) => void;
  onClose: () => void;
  onRevoke: (subscriptionId: string) => void;
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
    case 'revoked': {
      // The ledger holds no grants after a revoke, so the derived status is
      // always `expired`.
      const subscriptions = state.subscriptions.map((subscription) =>
        subscription.id === action.subscriptionId
          ? { ...subscription, status: 'expired' as const, isActive: false, endDateLabel: '—' }
          : subscription,
      );

      return {
        ...state,
        subscriptions,
        selectedSubscription: null,
        revokeReason: '',
        revokeConfirmation: '',
      };
    }
    default:
      return state;
  }
}

function getStatusBadge(status: AdminSubscriptionStatusViewModel, label: string) {
  switch (status) {
    case 'completed':
      return <Badge variant="success">{label}</Badge>;
    case 'pending':
      return <Badge variant="warning">{label}</Badge>;
    case 'cancelled':
    case 'failed':
      return <Badge variant="danger">{label}</Badge>;
    case 'expired':
      return <Badge variant="default">{label}</Badge>;
  }
}

function getPlanBadge(planName: string) {
  return <Badge variant="default">{planName}</Badge>;
}

function SubscriptionSearchBar({
  searchTerm,
  statusFilter,
  clearLabel,
  searchPlaceholder,
  onSearchTermChange,
  onSubmit,
  onClear,
}: SubscriptionSearchBarProps) {
  return (
    <form onSubmit={onSubmit} className="mb-4 flex flex-wrap items-center gap-4">
      <div className="max-w-md min-w-[240px] flex-1">
        <AdminSearchInput
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={onSearchTermChange}
          className="w-full"
        />
      </div>
      {searchTerm || statusFilter ? (
        <Button type="button" variant="outline" onClick={onClear}>
          {clearLabel}
        </Button>
      ) : null}
    </form>
  );
}

function SubscriptionStatusFilters({ currentFilter, onChange }: SubscriptionStatusFiltersProps) {
  const t = useTranslations('admin.subscriptionsPage');
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
        {t('filterAll')}
      </Button>
      {STATUS_OPTIONS.map((status) => (
        <Button
          key={status}
          onClick={() => onChange(status)}
          variant="ghost"
          className={`min-h-[40px] rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            currentFilter === status
              ? 'border border-green-200 bg-green-100 text-brand-trust'
              : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
          }`}
        >
          {t(`statuses.${status}`)}
        </Button>
      ))}
    </div>
  );
}

function SubscriptionsTable({
  subscriptions,
  pagination,
  noResultsLabel,
  onViewDetails,
}: SubscriptionsTableProps) {
  const t = useTranslations('admin.subscriptionsPage');
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('cardTitle')}</CardTitle>
        <CardDescription>
          {pagination.total > 0
            ? t('showing', {
                from: (pagination.page - 1) * pagination.limit + 1,
                to: Math.min(pagination.page * pagination.limit, pagination.total),
                total: pagination.total,
              })
            : noResultsLabel}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {subscriptions.length === 0 ? (
          <EmptyState title={noResultsLabel} description={t('emptyHint')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase text-neutral-700">
                <tr>
                  <th scope="col" className="px-6 py-3">
                    {t('columns.user')}
                  </th>
                  <th scope="col" className="px-6 py-3">
                    {t('columns.plan')}
                  </th>
                  <th scope="col" className="px-6 py-3">
                    {t('columns.amount')}
                  </th>
                  <th scope="col" className="px-6 py-3">
                    {t('columns.status')}
                  </th>
                  <th scope="col" className="px-6 py-3">
                    {t('columns.startDate')}
                  </th>
                  <th scope="col" className="px-6 py-3">
                    {t('columns.endDate')}
                  </th>
                  <th scope="col" className="px-6 py-3">
                    {t('columns.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((subscription) => (
                  <tr key={subscription.id} className="border-b bg-white hover:bg-neutral-50">
                    <td className="px-6 py-4 font-medium text-neutral-900">
                      {subscription.userEmail}
                    </td>
                    <td className="px-6 py-4">{getPlanBadge(subscription.plan.name)}</td>
                    <td className="px-6 py-4">{subscription.amountLabel}</td>
                    <td className="px-6 py-4">
                      {getStatusBadge(subscription.status, t(`statuses.${subscription.status}`))}
                    </td>
                    <td className="px-6 py-4 text-neutral-500">{subscription.startDateLabel}</td>
                    <td className="px-6 py-4 text-neutral-500">{subscription.endDateLabel}</td>
                    <td className="px-6 py-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewDetails(subscription)}
                        className="min-h-[40px] px-3 text-brand-trust hover:text-brand-trust"
                      >
                        <HiOutlineEye className="mr-1 size-4" /> {t('viewDetails')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SubscriptionDetailModal({
  subscription,
  actionLoadingId,
  reason,
  confirmation,
  onReasonChange,
  onConfirmationChange,
  onClose,
  onRevoke,
}: SubscriptionDetailModalProps) {
  const t = useTranslations('admin.subscriptionsPage');
  const busy = actionLoadingId === subscription?.id;
  const canRevoke =
    subscription !== null &&
    subscription.isActive &&
    reason.trim().length >= 3 &&
    confirmation.trim() === REVOKE_CONFIRMATION &&
    !busy;

  return (
    <Modal isOpen={!!subscription} onClose={onClose} title={t('detailTitle')}>
      {subscription ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <SubscriptionDetailField label={t('userEmail')} value={subscription.userEmail} />
            <SubscriptionDetailField
              label={t('columns.plan')}
              value={getPlanBadge(subscription.plan.name)}
            />
            <SubscriptionDetailField label={t('columns.amount')} value={subscription.amountLabel} />
            <SubscriptionDetailField
              label={t('columns.status')}
              value={getStatusBadge(subscription.status, t(`statuses.${subscription.status}`))}
            />
            <SubscriptionDetailField
              label={t('payosOrderId')}
              value={<span className="font-mono text-sm">{subscription.payosOrderId}</span>}
            />
            <SubscriptionDetailField
              label={t('payosTransactionId')}
              value={
                <span className="font-mono text-sm">{subscription.payosTransactionIdLabel}</span>
              }
            />
            <SubscriptionDetailField
              label={t('columns.startDate')}
              value={subscription.startDateLabel}
            />
            <SubscriptionDetailField
              label={t('columns.endDate')}
              value={subscription.endDateLabel}
            />
            <SubscriptionDetailField label={t('createdAt')} value={subscription.createdAtLabel} />
            <SubscriptionDetailField label={t('updatedAt')} value={subscription.updatedAtLabel} />
          </div>

          {subscription.isActive ? (
            <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <div>
                <p className="text-sm font-semibold text-red-800">{t('revokeTitle')}</p>
                <p className="mt-1 text-sm text-red-700">
                  {t.rich('revokeWarning', { strong: (chunks) => <strong>{chunks}</strong> })}
                </p>
              </div>
              <Input
                label={t('revokeReason')}
                value={reason}
                maxLength={500}
                disabled={busy}
                onChange={(event) => onReasonChange(event.target.value)}
                placeholder={t('revokeReasonPlaceholder')}
              />
              <Input
                label={t('revokeConfirmLabel', { word: REVOKE_CONFIRMATION })}
                value={confirmation}
                maxLength={16}
                disabled={busy}
                onChange={(event) => onConfirmationChange(event.target.value)}
                placeholder={REVOKE_CONFIRMATION}
              />
              <Button
                variant="destructive"
                size="sm"
                disabled={!canRevoke}
                onClick={() => onRevoke(subscription.id)}
                className="min-h-[40px] w-full justify-center px-3 text-sm font-medium"
              >
                {busy ? t('revoking') : t('revokeTitle')}
              </Button>
            </div>
          ) : (
            <p className="border-t pt-4 text-sm text-neutral-500">{t('noActivePremium')}</p>
          )}
        </div>
      ) : null}
    </Modal>
  );
}

function SubscriptionDetailField({ label, value }: SubscriptionDetailFieldProps) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-neutral-700">{label}</p>
      <div className="text-sm text-neutral-900">{value}</div>
    </div>
  );
}

export function AdminSubscriptionsPageClient() {
  const t = useTranslations('admin');
  const describeError = useAdminApiErrorMessage();
  const tCommon = useTranslations('common');
  const tPage = useTranslations('admin.subscriptionsPage');
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
            error: describeError(error),
          },
        });
      });

    return () => controller.abort();
  }, [
    state.pagination.limit,
    state.pagination.page,
    state.searchTerm,
    state.statusFilter,
    describeError,
  ]);

  const setSearchInput = (searchInput: string) => {
    dispatch({
      type: 'patch',
      value: { searchInput },
    });
  };

  const setStatusFilter = (statusFilter: '' | AdminFilterableSubscriptionStatusViewModel) => {
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

  const handleRevoke = async (subscriptionId: string) => {
    dispatch({ type: 'patch', value: { actionLoading: subscriptionId, error: '' } });
    try {
      await revokeAdminSubscription({ subscriptionId, reason: state.revokeReason.trim() });
      dispatch({ type: 'revoked', subscriptionId });
      dispatch({ type: 'patch', value: { success: tPage('revoked') } });
    } catch (error) {
      dispatch({
        type: 'patch',
        value: {
          error: describeError(error),
        },
      });
    }
    dispatch({ type: 'patch', value: { actionLoading: null } });
  };

  return (
    <AdminPageShell>
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader title={t('subscriptions')} description={tPage('description')} />

        <SubscriptionSearchBar
          searchTerm={state.searchInput}
          statusFilter={state.statusFilter}
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
              noResultsLabel={t('noSubscriptionsFound')}
              onViewDetails={(subscription) =>
                dispatch({
                  type: 'patch',
                  value: {
                    selectedSubscription: subscription,
                    revokeReason: '',
                    revokeConfirmation: '',
                  },
                })
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
          reason={state.revokeReason}
          confirmation={state.revokeConfirmation}
          onReasonChange={(revokeReason) => dispatch({ type: 'patch', value: { revokeReason } })}
          onConfirmationChange={(revokeConfirmation) =>
            dispatch({ type: 'patch', value: { revokeConfirmation } })
          }
          onClose={() =>
            dispatch({
              type: 'patch',
              value: { selectedSubscription: null, revokeReason: '', revokeConfirmation: '' },
            })
          }
          onRevoke={(subscriptionId) => void handleRevoke(subscriptionId)}
        />
      </div>
    </AdminPageShell>
  );
}
