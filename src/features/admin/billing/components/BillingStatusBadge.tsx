import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/Card';

/**
 * One colouring rule for every billing status on the page.
 *
 * Collection, fulfilment, settlement and attempt states are different
 * vocabularies that an operator reads side by side, so what the colour means
 * has to be the same in all of them: green is settled, amber wants a person,
 * red is money that went the wrong way.
 */
const GOOD = ['paid', 'fulfilled', 'settled', 'processed', 'accepted'];
const NEEDS_ATTENTION = [
  'review',
  'overpaid',
  'partial',
  'partially_refunded',
  'retryable_failure',
  'orphaned',
  'unallocated',
  'unsupported_schema',
];
const BAD = [
  'failed',
  'cancelled',
  'expired',
  'revoked',
  'charged_back',
  'refunded',
  'dead_letter',
  'permanent_failure',
  'rejected',
  'unauthenticated',
];

export function BillingStatusBadge({ value }: { value: string }): ReactNode {
  if (GOOD.includes(value)) return <Badge variant="success">{value}</Badge>;
  if (NEEDS_ATTENTION.includes(value)) return <Badge variant="warning">{value}</Badge>;
  if (BAD.includes(value)) return <Badge variant="danger">{value}</Badge>;
  return <Badge variant="default">{value}</Badge>;
}
