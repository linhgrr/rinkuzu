/**
 * How much of an order has actually been collected, derived from the payment
 * transaction ledger rather than from any single provider snapshot.
 *
 * Collection is about what the provider took, and nothing else. Whether the
 * customer is entitled to what they bought is a different question with a
 * different answer — a paid order whose payment was refunded is still `paid`
 * here and no longer entitled — and it is answered by the settlement ledger.
 *
 * `review` is a valid stored order state but is never derived here: it is only
 * ever set by an explicit escalation, so a later clean observation cannot
 * quietly wash an order out of operator review.
 */

export const ORDER_COLLECTION_STATES = ['unpaid', 'partial', 'paid', 'overpaid', 'review'] as const;
export type OrderCollectionState = (typeof ORDER_COLLECTION_STATES)[number];

/** The subset automation is allowed to compute. */
export type DerivedOrderCollectionState = Exclude<OrderCollectionState, 'review'>;

export interface OrderCollectionInput {
  /** Sum of incoming payment transactions against the order, in minor units. */
  readonly receivedMinor: number;
  /** What the order is owed, in minor units. */
  readonly finalMinor: number;
}

export interface OrderCollection {
  readonly status: DerivedOrderCollectionState;
  readonly excessMinor: number;
  /** True once the provider owes us nothing more on this order. */
  readonly fullyCollected: boolean;
}

export function deriveOrderCollection(input: OrderCollectionInput): OrderCollection {
  const excessMinor = Math.max(0, input.receivedMinor - input.finalMinor);
  const status: DerivedOrderCollectionState =
    input.receivedMinor > input.finalMinor
      ? 'overpaid'
      : input.receivedMinor === input.finalMinor
        ? 'paid'
        : input.receivedMinor > 0
          ? 'partial'
          : 'unpaid';
  return {
    status,
    excessMinor,
    fullyCollected: status === 'paid' || status === 'overpaid',
  };
}
