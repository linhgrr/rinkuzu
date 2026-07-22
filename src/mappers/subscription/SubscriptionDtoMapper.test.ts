import { describe, expect, it } from 'vitest';
import { SubscriptionDtoMapper } from '@/mappers/subscription/SubscriptionDtoMapper';

describe('SubscriptionDtoMapper', () => {
  it.each([
    ['pending', 'pending'],
    ['completed', 'paid'],
    ['failed', 'failed'],
    ['cancelled', 'cancelled'],
    ['expired', 'expired'],
  ] as const)('maps persisted %s status to cancellation outcome %s', (status, expected) => {
    expect(SubscriptionDtoMapper.toPaymentCancellationReconciliationDto(status)).toEqual({
      status: expected,
    });
  });
});
