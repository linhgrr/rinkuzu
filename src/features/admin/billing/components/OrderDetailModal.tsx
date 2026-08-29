import type { ReactNode } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';
import { Modal } from '@/components/ui/Modal';
import { BillingStatusBadge } from './BillingStatusBadge';
import { RecordAdjustmentForm } from './RecordAdjustmentForm';
import { ResolveExcessForm } from './ResolveExcessForm';
import type { AdminBillingOrderDetailViewModel } from '@/features/admin/billing/types/admin-billing-view-model';

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <div className="text-sm text-neutral-900">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-neutral-800">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Everything the system knows about one order, and the two actions that can
 * change it: recording money that moved outside the provider, and closing an
 * overpayment. Both are money events, so both are here rather than split
 * between a page and a database console.
 */
export function OrderDetailModal({
  detail,
  loading,
  error,
  onClose,
  onChanged,
}: {
  detail: AdminBillingOrderDetailViewModel | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onChanged: () => void;
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
            <DetailRow
              label="Collection"
              value={<BillingStatusBadge value={detail.order.collectionStatus} />}
            />
            <DetailRow
              label="Fulfilment"
              value={<BillingStatusBadge value={detail.order.fulfillmentStatus} />}
            />
            <DetailRow
              label="Settlement"
              value={<BillingStatusBadge value={detail.order.settlementStatus} />}
            />
            <DetailRow
              label="Overpayment"
              value={<BillingStatusBadge value={detail.order.excessResolution} />}
            />
            <DetailRow label="Promo" value={detail.order.promotionCode ?? '—'} />
          </div>

          <div className="rounded-lg border border-line p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Entitlement
            </p>
            <p className="mt-1 text-sm text-neutral-900">{detail.entitlement.summary}</p>
          </div>

          {detail.order.excessResolvable && detail.order.excessAmountLabel ? (
            <ResolveExcessForm
              orderId={detail.order.id}
              excessLabel={detail.order.excessAmountLabel}
              onResolved={onChanged}
            />
          ) : null}

          <Section title={`Payment attempts (${detail.attempts.length})`}>
            <div className="space-y-2">
              {detail.attempts.map((attempt) => (
                <div key={attempt.id} className="rounded-lg border border-line p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs">{attempt.label}</span>
                    <BillingStatusBadge value={attempt.collectionStatus} />
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
          </Section>

          <Section title={`Provider transactions (${detail.transactions.length})`}>
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
          </Section>

          <Section title={`External money adjustments (${detail.adjustments.length})`}>
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
              <RecordAdjustmentForm orderId={detail.order.id} onRecorded={onChanged} />
            </div>
          </Section>
        </div>
      ) : null}
    </Modal>
  );
}
