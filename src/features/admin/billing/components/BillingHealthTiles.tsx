import { Card } from '@/components/ui/Card';
import type { AdminBillingHealthViewModel } from '@/features/admin/billing/types/admin-billing-view-model';

interface HealthTile {
  key: keyof AdminBillingHealthViewModel;
  label: string;
  detail: string;
}

/**
 * The queues only a person can clear.
 *
 * Each tile is also an alert rule — the scheduler raises the same conditions
 * from the same counters — so a tile going amber here and a message arriving in
 * the ops mailbox are two views of one fact rather than two systems that can
 * disagree.
 */
const HEALTH_TILES: readonly HealthTile[] = [
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
    detail: 'Gave up — replay from the Webhooks tab',
  },
  {
    key: 'webhooksUnsupportedSchema',
    label: 'Unreadable webhooks',
    detail: 'Signature valid, payload we cannot parse',
  },
  {
    key: 'webhooksUnauthenticatedRecent',
    label: 'Unauthenticated webhooks (24h)',
    detail: 'Checksum key mismatch or unsolicited traffic',
  },
];

export const ZERO_BILLING_HEALTH: AdminBillingHealthViewModel = {
  ordersNeedingAttention: 0,
  paidButUnfulfilled: 0,
  attemptsInReview: 0,
  attemptsIndeterminate: 0,
  inboxOrphaned: 0,
  inboxRetryable: 0,
  inboxDeadLettered: 0,
  webhooksUnsupportedSchema: 0,
  webhooksUnauthenticatedRecent: 0,
};

export function BillingHealthTiles({ health }: { health: AdminBillingHealthViewModel }) {
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
