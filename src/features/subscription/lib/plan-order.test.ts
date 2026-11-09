import { describe, expect, it } from 'vitest';
import { sortPlansByPrice } from './plan-order';

// RIN-1277: /pricing, /subscription and the upgrade paywall list the same
// plans in the same order, cheapest first.
describe('sortPlansByPrice', () => {
  it('orders plans by price ascending', () => {
    const plans = [
      { id: 'yearly', price: 399_000 },
      { id: 'monthly', price: 49_000 },
      { id: 'half-year', price: 239_000 },
    ];

    expect(sortPlansByPrice(plans).map((plan) => plan.id)).toEqual([
      'monthly',
      'half-year',
      'yearly',
    ]);
  });

  it('keeps the catalogue order for plans at the same price', () => {
    const plans = [
      { id: 'b', price: 49_000 },
      { id: 'a', price: 49_000 },
      { id: 'c', price: 10_000 },
    ];

    expect(sortPlansByPrice(plans).map((plan) => plan.id)).toEqual(['c', 'b', 'a']);
  });

  it('does not mutate its input', () => {
    const plans = [
      { id: 'yearly', price: 399_000 },
      { id: 'monthly', price: 49_000 },
    ];

    sortPlansByPrice(plans);

    expect(plans.map((plan) => plan.id)).toEqual(['yearly', 'monthly']);
  });
});
