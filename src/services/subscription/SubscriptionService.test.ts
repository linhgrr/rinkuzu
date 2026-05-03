import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SubscriptionService } from './SubscriptionService';
import Plan from '@/models/Plan';

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/models/Plan', () => ({
  default: {
    findById: vi.fn(),
  },
}));

function createService(overrides: Partial<any> = {}) {
  const subscriptionRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    findByOrderId: vi.fn(),
    findByUser: vi.fn(),
    findExpiredSubscriptions: vi.fn(),
    updateById: vi.fn(),
    updateByOrderId: vi.fn(),
    deleteByOrderId: vi.fn(),
    ...overrides.subscriptionRepository,
  };
  const userRepository = {
    findById: vi.fn(),
    findExpiredSubscriptionUsers: vi.fn().mockResolvedValue([]),
    updateById: vi.fn(),
    ...overrides.userRepository,
  };
  const payosService = {
    createPayment: vi.fn(),
    verifyPayment: vi.fn(),
    getPaymentInfo: vi.fn(),
    testConnection: vi.fn(),
    ...overrides.payosService,
  };

  return {
    subscriptionRepository,
    userRepository,
    payosService,
    service: new SubscriptionService(subscriptionRepository, userRepository, payosService),
  };
}

describe('SubscriptionService billing hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects verification when the order does not belong to the current user', async () => {
    const { service, payosService } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          user: { toString: () => 'owner-user' },
          status: 'pending',
        }),
      },
    });

    await expect(service.verifyAndActivateSubscription(123, 'other-user')).rejects.toThrow(
      'Subscription does not belong to current user',
    );
    expect(payosService.verifyPayment).not.toHaveBeenCalled();
  });

  it('is idempotent for completed subscriptions without extending dates', async () => {
    const startDate = new Date('2099-01-01T00:00:00Z');
    const endDate = new Date('2099-02-01T00:00:00Z');
    const { service, subscriptionRepository, payosService, userRepository } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          user: { toString: () => 'user-1' },
          type: 'premium',
          status: 'completed',
          startDate,
          endDate,
          isActive: true,
        }),
      },
    });

    const result = await service.verifyAndActivateSubscription(123, 'user-1');

    expect(result.subscription.startDate).toBe(startDate);
    expect(result.subscription.endDate).toBe(endDate);
    expect(payosService.verifyPayment).not.toHaveBeenCalled();
    expect(subscriptionRepository.updateByOrderId).not.toHaveBeenCalled();
    expect(userRepository.updateById).not.toHaveBeenCalled();
  });

  it('rejects PayOS amount mismatches before activation', async () => {
    vi.mocked(Plan.findById).mockResolvedValue({
      durationInfo: { iso8601: 'P1M' },
    } as any);

    const { service, subscriptionRepository, payosService, userRepository } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          user: { toString: () => 'user-1' },
          type: 'premium',
          amount: 99000,
          status: 'pending',
        }),
      },
      payosService: {
        verifyPayment: vi.fn().mockResolvedValue({
          code: '00',
          data: {
            status: 'PAID',
            orderCode: '123',
            amount: 1000,
          },
        }),
      },
    });

    await expect(service.verifyAndActivateSubscription(123, 'user-1')).rejects.toThrow(
      'Payment amount mismatch',
    );
    expect(subscriptionRepository.updateByOrderId).not.toHaveBeenCalled();
    expect(userRepository.updateById).not.toHaveBeenCalled();
    expect(payosService.verifyPayment).toHaveBeenCalledWith(123);
  });

  it('does not create payments for inactive plans', async () => {
    vi.mocked(Plan.findById).mockResolvedValue({ isActive: false } as any);
    const { service, subscriptionRepository } = createService({
      userRepository: {
        findById: vi.fn().mockResolvedValue({ email: 'user@example.com' }),
      },
    });

    await expect(service.createPaymentRequest('user-1', 'inactive-plan')).rejects.toThrow(
      'Invalid subscription plan',
    );
    expect(subscriptionRepository.create).not.toHaveBeenCalled();
  });

  it('activates webhook-verified payments with the stored plan duration', async () => {
    vi.mocked(Plan.findById).mockResolvedValue({
      durationInfo: { iso8601: 'P1M' },
    } as any);

    const { service, subscriptionRepository, userRepository } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          user: { toString: () => 'user-1' },
          type: 'premium',
          amount: 99000,
          status: 'pending',
        }),
      },
    });

    const result = await service.activateVerifiedSubscription(123, {
      orderCode: '123',
      amount: 99000,
      reference: 'payos-ref',
      code: '00',
    });

    expect(result.success).toBe(true);
    expect(subscriptionRepository.updateByOrderId).toHaveBeenCalledWith(
      '123',
      expect.objectContaining({
        status: 'completed',
        payosTransactionId: 'payos-ref',
        isActive: true,
      }),
    );
    expect(userRepository.updateById).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        subscription: expect.objectContaining({
          payosOrderId: '123',
          payosTransactionId: 'payos-ref',
          isActive: true,
        }),
      }),
    );
  });

  it('marks expired user subscriptions inactive when reading status', async () => {
    const expiredEndDate = new Date('2025-12-28T00:00:00Z');
    const { service, subscriptionRepository, userRepository } = createService({
      userRepository: {
        findById: vi.fn().mockResolvedValue({
          subscription: {
            type: 'premium_6months',
            isActive: true,
            endDate: expiredEndDate,
            payosOrderId: 'order-1',
          },
        }),
      },
    });

    const subscription = await service.getUserSubscription('user-1');

    expect(subscription).toMatchObject({
      type: 'premium_6months',
      isActive: false,
      status: 'expired',
    });
    expect(userRepository.updateById).toHaveBeenCalledWith('user-1', {
      'subscription.isActive': false,
    });
    expect(subscriptionRepository.updateByOrderId).toHaveBeenCalledWith('order-1', {
      isActive: false,
      status: 'expired',
    });
  });

  it('expires both subscription records and stale embedded user subscriptions in cron checks', async () => {
    const { service, subscriptionRepository, userRepository } = createService({
      subscriptionRepository: {
        findExpiredSubscriptions: vi.fn().mockResolvedValue([
          {
            _id: { toString: () => 'sub-1' },
            user: { toString: () => 'user-1' },
          },
        ]),
      },
      userRepository: {
        findExpiredSubscriptionUsers: vi.fn().mockResolvedValue([
          {
            _id: { toString: () => 'user-2' },
            subscription: { payosOrderId: 'order-2' },
          },
        ]),
      },
    });

    const updatedCount = await service.checkAndUpdateExpiredSubscriptions();

    expect(updatedCount).toBe(2);
    expect(subscriptionRepository.updateById).toHaveBeenCalledWith('sub-1', {
      isActive: false,
      status: 'expired',
    });
    expect(userRepository.updateById).toHaveBeenCalledWith('user-1', {
      'subscription.isActive': false,
    });
    expect(userRepository.updateById).toHaveBeenCalledWith('user-2', {
      'subscription.isActive': false,
    });
    expect(subscriptionRepository.updateByOrderId).toHaveBeenCalledWith('order-2', {
      isActive: false,
      status: 'expired',
    });
  });
});
