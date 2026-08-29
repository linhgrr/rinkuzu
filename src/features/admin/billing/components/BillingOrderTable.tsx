import { HiOutlineEye } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { BillingStatusBadge } from './BillingStatusBadge';
import type { AdminBillingOrderRowViewModel } from '@/features/admin/billing/types/admin-billing-view-model';

const COLUMNS = [
  'Order',
  'Buyer',
  'Money',
  'Collection',
  'Fulfilment',
  'Settlement',
  'Updated',
] as const;

export function BillingOrderTable({
  orders,
  loading,
  emptyDescription,
  onInspect,
}: {
  orders: readonly AdminBillingOrderRowViewModel[];
  loading: boolean;
  emptyDescription: string;
  onInspect: (orderId: string) => void;
}) {
  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (orders.length === 0) {
    return <EmptyState title="Nothing here" description={emptyDescription} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-neutral-50 text-xs uppercase text-neutral-700">
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} scope="col" className="px-4 py-3">
                {column}
              </th>
            ))}
            <th scope="col" className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b bg-white hover:bg-neutral-50">
              <td className="px-4 py-3">
                <span className="font-mono text-xs">{order.orderCode}</span>
                <span className="block text-xs text-neutral-500">{order.planName}</span>
              </td>
              <td className="px-4 py-3">{order.userEmail}</td>
              <td className="px-4 py-3">
                <span className={order.moneyMismatch ? 'font-semibold text-amber-700' : ''}>
                  {order.receivedAmountLabel} / {order.finalAmountLabel}
                </span>
                {order.excessAmountLabel ? (
                  <span className="block text-xs text-amber-700">
                    excess {order.excessAmountLabel}
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <BillingStatusBadge value={order.collectionStatus} />
                <span className="mt-1 block text-xs text-neutral-500">
                  attempt: {order.attemptCollectionStatus}
                </span>
              </td>
              <td className="px-4 py-3">
                <BillingStatusBadge value={order.fulfillmentStatus} />
              </td>
              <td className="px-4 py-3">
                <BillingStatusBadge value={order.settlementStatus} />
              </td>
              <td className="px-4 py-3 text-neutral-500">{order.updatedAtLabel}</td>
              <td className="px-4 py-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onInspect(order.id)}
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
  );
}
