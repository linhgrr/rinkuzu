'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { AdminPageHeader } from '@/features/admin/components/AdminPageHeader';
import { AdminPageShell } from '@/features/admin/components/AdminPageShell';
import { AdminSearchInput } from '@/features/admin/components/AdminSearchInput';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import Pagination from '@/components/ui/Pagination';
import { HiOutlineRefresh } from 'react-icons/hi';
import { BillingHealthTiles } from '@/features/admin/billing/components/BillingHealthTiles';
import { BillingOrderTable } from '@/features/admin/billing/components/BillingOrderTable';
import { OrderDetailModal } from '@/features/admin/billing/components/OrderDetailModal';
import { WebhookDiagnosticsPanel } from '@/features/admin/billing/components/WebhookDiagnosticsPanel';
import { useAdminBillingOrders } from '@/features/admin/billing/hooks/useAdminBillingOrders';
import { useWebhookDiagnostics } from '@/features/admin/billing/hooks/useWebhookDiagnostics';
import type { AdminOrderBucketViewModel } from '@/features/admin/billing/types/admin-billing-view-model';

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

type BillingTab = 'orders' | 'webhooks';

/**
 * The operator's view of the payment pipeline: what state every order is in,
 * and what actually arrived at the webhook door.
 *
 * Both halves belong on one page because they are one investigation. An order
 * that took money and granted nothing is explained by a delivery that was
 * rejected, dead-lettered, or carried a body the parser could not read, and
 * before the second tab existed that explanation lived only in the database.
 */
export function AdminBillingPageClient() {
  const [tab, setTab] = useState<BillingTab>('orders');
  const orders = useAdminBillingOrders();
  const diagnostics = useWebhookDiagnostics(tab === 'webhooks');

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    orders.submitSearch();
  };

  const activeBucket = BUCKETS.find((bucket) => bucket.value === orders.bucket);

  return (
    <AdminPageShell>
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader
          title="Billing orders"
          description="Payment pipeline health, per-order provider facts, and the webhook door's own record"
        />

        <BillingHealthTiles health={orders.health} />

        <div className="mb-6 flex flex-wrap gap-2 border-b border-line">
          {(['orders', 'webhooks'] as const).map((candidate) => (
            <Button
              key={candidate}
              variant="ghost"
              onClick={() => setTab(candidate)}
              className={`min-h-11 rounded-none border-b-2 px-4 py-2 text-sm font-medium ${
                tab === candidate
                  ? 'border-brand-trust text-brand-trust'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {candidate === 'orders' ? 'Orders' : 'Webhooks'}
            </Button>
          ))}
        </div>

        {tab === 'webhooks' ? (
          <WebhookDiagnosticsPanel diagnostics={diagnostics} />
        ) : (
          <>
            <form onSubmit={handleSearch} className="mb-4 flex flex-wrap items-center gap-3">
              <div className="max-w-md min-w-60 flex-1">
                <AdminSearchInput
                  placeholder="Public order id, provider order code, or buyer email"
                  value={orders.searchInput}
                  onChange={orders.setSearchInput}
                  className="w-full"
                />
              </div>
              <Button type="button" variant="outline" onClick={orders.reload}>
                <HiOutlineRefresh className="mr-1 size-4" /> Refresh
              </Button>
            </form>

            <div className="mb-2 flex flex-wrap gap-2">
              {BUCKETS.map((bucket) => (
                <Button
                  key={bucket.value}
                  variant="ghost"
                  onClick={() => orders.setBucket(bucket.value)}
                  className={`min-h-11 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    orders.bucket === bucket.value
                      ? 'border border-green-200 bg-green-100 text-brand-trust'
                      : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
                  }`}
                >
                  {bucket.label}
                </Button>
              ))}
            </div>
            {activeBucket ? (
              <p className="mb-6 text-sm text-neutral-500">{activeBucket.hint}</p>
            ) : null}

            {orders.error ? <ErrorState message={orders.error} className="mb-6" /> : null}

            <Card>
              <CardHeader>
                <CardTitle>
                  {orders.pagination.total} order{orders.pagination.total === 1 ? '' : 's'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BillingOrderTable
                  orders={orders.orders}
                  loading={orders.status === 'loading'}
                  emptyDescription={
                    orders.bucket === 'attention'
                      ? 'No order needs manual attention.'
                      : 'No order matches the current filter.'
                  }
                  onInspect={orders.openDetail}
                />
              </CardContent>
            </Card>

            {orders.pagination.totalPages > 1 ? (
              <div className="mt-6">
                <Pagination
                  currentPage={orders.pagination.page}
                  totalPages={orders.pagination.totalPages}
                  onPageChange={orders.setPage}
                />
              </div>
            ) : null}
          </>
        )}

        <OrderDetailModal
          detail={orders.detail}
          loading={orders.detailLoading}
          error={orders.detailError}
          onClose={orders.closeDetail}
          onChanged={orders.refreshAfterMutation}
        />
      </div>
    </AdminPageShell>
  );
}
