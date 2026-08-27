'use client';

import { useEffect, useReducer, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader';
import { AdminPageShell } from '@/features/admin/components/AdminPageShell';
import { AdminSearchInput } from '@/features/admin/components/AdminSearchInput';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Modal } from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import { HiOutlineEye, HiOutlineRefresh } from 'react-icons/hi';
import {
  fetchAdminBillingOrderDetail,
  fetchAdminBillingOrders,
  recordExternalAdjustment,
} from '@/features/admin/billing/api/admin-billing-api';
import type {
  AdminBillingHealthViewModel,
  AdminBillingOrderDetailViewModel,
  AdminBillingOrderRowViewModel,
  AdminBillingPaginationViewModel,
  AdminOrderBucketViewModel,
} from '@/features/admin/billing/types/admin-billing-view-model';

const BUCKETS: Array<{ value: AdminOrderBucketViewModel; label: string; hint: string }> = [
  {
    value: 'attention',
    label: 'Needs attention',
    hint: 'Stuck, part-paid, overpaid or clawed back',
  },
  { value: 'unpaid', label: 'Unpaid', hint: 'Awaiting payment' },
  { value: 'paid', label: 'Paid', hint: 'Money collected' },
  { value: 'settled_out', label: 'Refunded / disputed', hint: 'Money left again' },
  { value: 'all', label: 'All', hint: 'Every order' },
];

const HEALTH_TILES: Array<{
  key: keyof AdminBillingHealthViewModel;
  label: string;
  detail: string;
}> = [
  {
    key: 'ordersNeedingAttention',
    label: 'Orders needing attention',
    detail: 'Nothing else will resolve these',
  },
  {
    key: 'paidButUnfulfilled',
    label: 'Paid, not fulfilled',
    detail: 'Money taken, Premium not granted',
  },
  { key: 'attemptsInReview', label: 'Attempts in review', detail: 'Provider state disagreed' },
  {
    key: 'attemptsIndeterminate',
    label: 'Unconfirmed checkout links',
    detail: 'Provider never said whether a link exists',
  },
  { key: 'inboxOrphaned', label: 'Orphaned webhooks', detail: 'No matching payment attempt' },
  { key: 'inboxRetryable', label: 'Retrying webhooks', detail: 'Transient processing failures' },
  {
    key: 'inboxDeadLettered',
    label: 'Dead-lettered webhooks',
    detail: 'Gave up — needs manual replay',
  },
];

const ZERO_HEALTH: AdminBillingHealthViewModel = {
  ordersNeedingAttention: 0,
  paidButUnfulfilled: 0,
  attemptsInReview: 0,
  attemptsIndeterminate: 0,
  inboxOrphaned: 0,
  inboxRetryable: 0,
  inboxDeadLettered: 0,
};

interface AdminBillingState {
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

type AdminBillingAction =
  | { type: 'patch'; value: Partial<AdminBillingState> }
  | {
      type: 'loadSuccess';
      value: {
        orders: AdminBillingOrderRowViewModel[];
        health: AdminBillingHealthViewModel;
        pagination: AdminBillingPaginationViewModel;
      };
    };

const initialState: AdminBillingState = {
  status: 'loading',
  orders: [],
  health: ZERO_HEALTH,
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

function reducer(state: AdminBillingState, action: AdminBillingAction): AdminBillingState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.value };
    case 'loadSuccess':
      return {
        ...state,
        status: 'ready',
        orders: action.value.orders,
        health: action.value.health,
        pagination: action.value.pagination,
        error: '',
      };
    default:
      return state;
  }
}

function statusBadge(value: string): ReactNode {
  if (value === 'paid' || value === 'fulfilled' || value === 'settled') {
    return <Badge variant="success">{value}</Badge>;
  }
  if (value === 'review' || value === 'overpaid' || value === 'partial') {
    return <Badge variant="warning">{value}</Badge>;
  }
  if (
    value === 'failed' ||
    value === 'cancelled' ||
    value === 'expired' ||
    value === 'revoked' ||
    value === 'charged_back'
  ) {
    return <Badge variant="danger">{value}</Badge>;
  }
  return <Badge variant="default">{value}</Badge>;
}

function HealthTiles({ health }: { health: AdminBillingHealthViewModel }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
      {HEALTH_TILES.map((tile) => {
        const count = health[tile.key];
        return (
          <Card
            key={tile.key}
            className={`p-4 ${count > 0 ? 'border-amber-300 bg-amber-50' : 'border-line'}`}
          >
            <p
              className={`text-2xl font-semibold ${count > 0 ? 'text-amber-900' : 'text-neutral-900'}`}
            >
              {count}
            </p>
            <p className="mt-1 text-sm font-medium text-neutral-700">{tile.label}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{tile.detail}</p>
          </Card>
        );
      })}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <div className="text-sm text-neutral-900">{value}</div>
    </div>
  );
}

const ADJUSTMENT_TYPES = ['refund', 'chargeback', 'chargeback_reversal', 'credit'] as const;
type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];

/**
 * Recording a refund or chargeback is what moves money out and — when
 * auto-revocation is on — claws the matching Premium grant back. The reference
 * must be the provider's own, because the ledger dedupes on it.
 */
function RecordAdjustmentForm({
  orderId,
  onRecorded,
}: {
  orderId: string;
  onRecorded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<AdjustmentType>('refund');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [allocation, setAllocation] = useState<'principal' | 'excess'>('principal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const parsedAmount = Number(amount);
  const canSubmit =
    reference.trim().length > 0 && Number.isSafeInteger(parsedAmount) && parsedAmount > 0 && !busy;

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await recordExternalAdjustment({
        orderId,
        type,
        externalReference: reference.trim(),
        amount: parsedAmount,
        allocation,
        occurredAt: new Date().toISOString(),
      });
      setReference('');
      setAmount('');
      setOpen(false);
      onRecorded();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to record adjustment');
    }
    setBusy(false);
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="min-h-11">
        Record refund / chargeback
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-line p-3">
      <div className="flex flex-wrap gap-2">
        {ADJUSTMENT_TYPES.map((candidate) => (
          <Button
            key={candidate}
            variant={type === candidate ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setType(candidate)}
            className="min-h-11"
          >
            {candidate}
          </Button>
        ))}
      </div>
      <Input
        label="Provider reference (dedupe key)"
        value={reference}
        maxLength={200}
        disabled={busy}
        onChange={(event) => setReference(event.target.value)}
      />
      <Input
        label="Amount in VND (whole dong)"
        value={amount}
        inputMode="numeric"
        disabled={busy}
        onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ''))}
      />
      <div className="flex flex-wrap gap-2">
        {(['principal', 'excess'] as const).map((candidate) => (
          <Button
            key={candidate}
            variant={allocation === candidate ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setAllocation(candidate)}
            className="min-h-11"
          >
            {candidate}
          </Button>
        ))}
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button size="sm" disabled={!canSubmit} onClick={() => void submit()} className="min-h-11">
          {busy ? 'Recording…' : 'Record'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => setOpen(false)}
          className="min-h-11"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function OrderDetailModal({
  detail,
  loading,
  error,
  onClose,
  onRecorded,
}: {
  detail: AdminBillingOrderDetailViewModel | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onRecorded: () => void;
}) {
  return (
    <Modal isOpen={loading || Boolean(detail) || Boolean(error)} onClose={onClose} title="Order">
      {loading ? <p className="text-sm text-neutral-500">Loading order…</p> : null}
      {error ? <ErrorState message={error} /> : null}
      {detail ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <DetailRow
              label="Public id"
              value={<span className="font-mono text-xs">{detail.order.id}</span>}
            />
            <DetailRow
              label="Provider order code"
              value={<span className="font-mono">{detail.order.orderCode}</span>}
            />
            <DetailRow label="Buyer" value={detail.order.userEmail} />
            <DetailRow label="Plan" value={detail.order.planName} />
            <DetailRow label="Owed" value={detail.order.finalAmountLabel} />
            <DetailRow
              label="Received"
              value={
                <span className={detail.order.moneyMismatch ? 'font-semibold text-amber-700' : ''}>
                  {detail.order.receivedAmountLabel}
                  {detail.order.excessAmountLabel
                    ? ` (excess ${detail.order.excessAmountLabel})`
                    : ''}
                </span>
              }
            />
            <DetailRow label="Collection" value={statusBadge(detail.order.collectionStatus)} />
            <DetailRow label="Fulfilment" value={statusBadge(detail.order.fulfillmentStatus)} />
            <DetailRow label="Settlement" value={statusBadge(detail.order.settlementStatus)} />
            <DetailRow label="Promo" value={detail.order.promotionCode ?? '—'} />
          </div>

          <div className="rounded-lg border border-line p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Entitlement
            </p>
            <p className="mt-1 text-sm text-neutral-900">{detail.entitlement.summary}</p>
          </div>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-neutral-800">
              Payment attempts ({detail.attempts.length})
            </h3>
            <div className="space-y-2">
              {detail.attempts.map((attempt) => (
                <div key={attempt.id} className="rounded-lg border border-line p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs">{attempt.label}</span>
                    {statusBadge(attempt.collectionStatus)}
                    <span className="text-xs text-neutral-500">
                      {attempt.createOutcome} · paid {attempt.amountPaidLabel} · reconciled{' '}
                      {attempt.reconcileCount}×
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    created {attempt.createdAtLabel} · expires {attempt.expiresAtLabel} · next check{' '}
                    {attempt.nextReconcileAtLabel}
                  </p>
                  {attempt.lastProviderError ? (
                    <p className="mt-1 text-xs text-red-700">{attempt.lastProviderError}</p>
                  ) : null}
                </div>
              ))}
              {detail.attempts.length === 0 ? (
                <p className="text-sm text-neutral-500">No attempts.</p>
              ) : null}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-neutral-800">
              Provider transactions ({detail.transactions.length})
            </h3>
            <div className="space-y-1">
              {detail.transactions.map((transaction) => (
                <p key={transaction.id} className="text-sm text-neutral-700">
                  <span className="font-mono text-xs">{transaction.externalReference}</span> ·{' '}
                  {transaction.transactionType} · {transaction.amountLabel} ·{' '}
                  {transaction.settlementState} · {transaction.providerEventAtLabel}
                </p>
              ))}
              {detail.transactions.length === 0 ? (
                <p className="text-sm text-neutral-500">No captured transactions.</p>
              ) : null}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-neutral-800">
              External money adjustments ({detail.adjustments.length})
            </h3>
            <div className="space-y-1">
              {detail.adjustments.map((adjustment) => (
                <p key={adjustment.id} className="text-sm text-neutral-700">
                  <span className="font-mono text-xs">{adjustment.externalReference}</span> ·{' '}
                  {adjustment.type} · {adjustment.amountLabel} · {adjustment.allocation} ·{' '}
                  {adjustment.occurredAtLabel}
                </p>
              ))}
              {detail.adjustments.length === 0 ? (
                <p className="text-sm text-neutral-500">None recorded.</p>
              ) : null}
            </div>
            <div className="mt-3">
              <RecordAdjustmentForm orderId={detail.order.id} onRecorded={onRecorded} />
            </div>
          </section>
        </div>
      ) : null}
    </Modal>
  );
}

export default function AdminBillingPage() {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const controller = new AbortController();
    dispatch({ type: 'patch', value: { status: 'loading' } });

    void fetchAdminBillingOrders({
      page: state.pagination.page,
      limit: state.pagination.limit,
      bucket: state.bucket,
      searchTerm: state.searchTerm,
      signal: controller.signal,
    })
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
  }, [
    state.bucket,
    state.pagination.limit,
    state.pagination.page,
    state.searchTerm,
    state.reloadToken,
  ]);

  const openDetail = (orderId: string) => {
    dispatch({ type: 'patch', value: { detailLoading: true, detail: null, detailError: '' } });
    void fetchAdminBillingOrderDetail(orderId)
      .then((detail) => dispatch({ type: 'patch', value: { detail } }))
      .catch((error: unknown) =>
        dispatch({
          type: 'patch',
          value: {
            detailError: error instanceof Error ? error.message : 'Failed to load order',
          },
        }),
      )
      .finally(() => dispatch({ type: 'patch', value: { detailLoading: false } }));
  };

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    dispatch({
      type: 'patch',
      value: {
        searchTerm: state.searchInput.trim(),
        pagination: { ...state.pagination, page: 1 },
      },
    });
  };

  const activeBucket = BUCKETS.find((bucket) => bucket.value === state.bucket);

  return (
    <AdminPageShell>
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader
          title="Billing orders"
          description="Payment pipeline health and per-order provider facts"
        />

        <HealthTiles health={state.health} />

        <form onSubmit={handleSearch} className="mb-4 flex flex-wrap items-center gap-3">
          <div className="max-w-md min-w-60 flex-1">
            <AdminSearchInput
              placeholder="Public order id, provider order code, or buyer email"
              value={state.searchInput}
              onChange={(searchInput) => dispatch({ type: 'patch', value: { searchInput } })}
              className="w-full"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              dispatch({ type: 'patch', value: { reloadToken: state.reloadToken + 1 } })
            }
          >
            <HiOutlineRefresh className="mr-1 size-4" /> Refresh
          </Button>
        </form>

        <div className="mb-2 flex flex-wrap gap-2">
          {BUCKETS.map((bucket) => (
            <Button
              key={bucket.value}
              variant="ghost"
              onClick={() =>
                dispatch({
                  type: 'patch',
                  value: {
                    bucket: bucket.value,
                    pagination: { ...state.pagination, page: 1 },
                  },
                })
              }
              className={`min-h-11 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                state.bucket === bucket.value
                  ? 'border border-green-200 bg-green-100 text-brand-trust'
                  : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
              }`}
            >
              {bucket.label}
            </Button>
          ))}
        </div>
        {activeBucket ? <p className="mb-6 text-sm text-neutral-500">{activeBucket.hint}</p> : null}

        {state.error ? <ErrorState message={state.error} className="mb-6" /> : null}

        <Card>
          <CardHeader>
            <CardTitle>
              {state.pagination.total} order{state.pagination.total === 1 ? '' : 's'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {state.status === 'loading' ? (
              <p className="text-sm text-neutral-500">Loading…</p>
            ) : state.orders.length === 0 ? (
              <EmptyState
                title="Nothing here"
                description={
                  state.bucket === 'attention'
                    ? 'No order needs manual attention.'
                    : 'No order matches the current filter.'
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-50 text-xs uppercase text-neutral-700">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        Order
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Buyer
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Money
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Collection
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Fulfilment
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Settlement
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Updated
                      </th>
                      <th scope="col" className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {state.orders.map((order) => (
                      <tr key={order.id} className="border-b bg-white hover:bg-neutral-50">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs">{order.orderCode}</span>
                          <span className="block text-xs text-neutral-500">{order.planName}</span>
                        </td>
                        <td className="px-4 py-3">{order.userEmail}</td>
                        <td className="px-4 py-3">
                          <span
                            className={order.moneyMismatch ? 'font-semibold text-amber-700' : ''}
                          >
                            {order.receivedAmountLabel} / {order.finalAmountLabel}
                          </span>
                          {order.excessAmountLabel ? (
                            <span className="block text-xs text-amber-700">
                              excess {order.excessAmountLabel}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          {statusBadge(order.collectionStatus)}
                          <span className="mt-1 block text-xs text-neutral-500">
                            attempt: {order.attemptCollectionStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3">{statusBadge(order.fulfillmentStatus)}</td>
                        <td className="px-4 py-3">{statusBadge(order.settlementStatus)}</td>
                        <td className="px-4 py-3 text-neutral-500">{order.updatedAtLabel}</td>
                        <td className="px-4 py-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDetail(order.id)}
                            className="min-h-11 px-3"
                          >
                            <HiOutlineEye className="mr-1 size-4" /> Inspect
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

        {state.pagination.totalPages > 1 ? (
          <div className="mt-6">
            <Pagination
              currentPage={state.pagination.page}
              totalPages={state.pagination.totalPages}
              onPageChange={(page) =>
                dispatch({ type: 'patch', value: { pagination: { ...state.pagination, page } } })
              }
            />
          </div>
        ) : null}

        <OrderDetailModal
          detail={state.detail}
          loading={state.detailLoading}
          error={state.detailError}
          onClose={() => dispatch({ type: 'patch', value: { detail: null, detailError: '' } })}
          onRecorded={() => {
            // Money and entitlement both moved; re-read instead of guessing.
            if (state.detail) openDetail(state.detail.order.id);
            dispatch({ type: 'patch', value: { reloadToken: state.reloadToken + 1 } });
          }}
        />
      </div>
    </AdminPageShell>
  );
}
