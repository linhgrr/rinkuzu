/**
 * The one plan order every plan list uses: cheapest first (RIN-1277).
 * `/pricing`, `/subscription` and the upgrade paywall all go through this, so
 * a learner sees the same plans in the same place wherever they compare them.
 * Plans at the same price keep their catalogue order.
 */
export function sortPlansByPrice<T extends { price: number }>(plans: readonly T[]): T[] {
  return [...plans].sort((a, b) => a.price - b.price);
}
