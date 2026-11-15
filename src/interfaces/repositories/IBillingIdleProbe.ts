/**
 * The one question an idle scheduler tick asks before it does any work: is
 * anything in the webhook inbox or the fulfillment backlog due yet?
 *
 * Kept apart from the settlement port on purpose. It writes nothing and holds
 * no lease, so it can run outside a transaction, and a "no" from it is only
 * ever a reason to skip this tick: the next tick asks again.
 */
export interface IBillingIdleProbe {
  hasDueInboxWork(nowMs: number): Promise<boolean>;
}
