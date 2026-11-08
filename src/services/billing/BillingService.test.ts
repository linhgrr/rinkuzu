import { describe, expect, it, vi } from 'vitest';
import type { IBillingOrderRepository } from '@/interfaces/repositories/IBillingOrderRepository';
import type { IBillingPromotionRepository } from '@/interfaces/repositories/IBillingPromotionRepository';
import type { IBillingSettlementRepository } from '@/interfaces/repositories/IBillingSettlementRepository';
import { BillingService } from './BillingService';
import type { BillingPaymentProvider } from './payos-adapter';

/**
 * Releasing a promotion reservation requires its order's attempt to be
 * terminal, and reconciliation is what makes an attempt terminal. Run the two
 * together and a reservation reconciliation is about to free is instead
 * rescheduled with backoff, so they must stay strictly in sequence.
 */
describe('BillingService.reconcileDueAttempts', () => {
  it('releases promotion reservations only after reconciliation has finished', async () => {
    const steps: string[] = [];
    const settlement = Object.assign({} as IBillingSettlementRepository, {
      claimNextDueAttempt: vi.fn(async () => {
        steps.push('reconcile:start');
        await new Promise((resolve) => setTimeout(resolve, 5));
        steps.push('reconcile:end');
        return null;
      }),
    });
    const promotions = Object.assign({} as IBillingPromotionRepository, {
      releaseDuePromotionReservations: vi.fn(async () => {
        steps.push('release');
        return 2;
      }),
    });
    const service = new BillingService(
      {} as IBillingOrderRepository,
      settlement,
      promotions,
      {} as BillingPaymentProvider,
    );

    const result = await service.reconcileDueAttempts({ limit: 7 });

    expect(steps).toEqual(['reconcile:start', 'reconcile:end', 'release']);
    expect(promotions.releaseDuePromotionReservations).toHaveBeenCalledWith(7);
    expect(result.processed).toBe(2);
  });
});
