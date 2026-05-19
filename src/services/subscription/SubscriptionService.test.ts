import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SubscriptionService } from './SubscriptionService';
import Plan from '@/models/Plan';

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/models/Plan', () => ({
  default: {
    findById: vi.fn(),
    find: vi.fn(),
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
    ...overrides['subscriptionRepository'],
  };
  const userRepository = {
    findById: vi.fn(),
    findExpiredSubscriptionUsers: vi.fn().mockResolvedValue([]),
    updateById: vi.fn(),
    ...overrides['userRepository'],
  };
  const payosService = {
    createPayment: vi.fn(),
    verifyPayment: vi.fn(),
    getPaymentInfo: vi.fn(),
    testConnection: vi.fn(),
    ...overrides['payosService'],
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

  it('creates payment requests and stores PayOS checkout URLs', async () => {
    vi.mocked(Plan.findById).mockResolvedValue({
      _id: 'premium',
      name: 'Premium plan name that is longer than PayOS allows',
      price: 99000,
      isActive: true,
    } as any);

    const { service, subscriptionRepository, payosService } = createService({
      userRepository: {
        findById: vi.fn().mockResolvedValue({
          email: 'user@example.com',
          name: 'User',
          subscription: { isActive: false },
        }),
      },
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue(null),
      },
      payosService: {
        createPayment: vi.fn().mockResolvedValue({
          code: '00',
          data: {
            checkoutUrl: 'https://pay.payos.vn/web/checkout',
            qrCode: 'qr-code',
          },
        }),
      },
    });

    const result = await service.createPaymentRequest('user-1', 'premium');

    expect(result.paymentUrl).toBe('https://pay.payos.vn/web/checkout');
    expect(result.qrCode).toBe('qr-code');
    expect(subscriptionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userEmail: 'user@example.com',
        type: 'premium',
        amount: 99000,
        status: 'pending',
      }),
    );
    expect(payosService.createPayment).toHaveBeenCalledWith(
      expect.any(Number),
      99000,
      'Premium plan name that is',
      expect.stringContaining('/payment/success?orderCode='),
      expect.stringContaining('/payment/cancel?orderCode='),
      'user@example.com',
      'User',
    );
    expect(subscriptionRepository.updateByOrderId).toHaveBeenCalledWith(expect.any(String), {
      payosPaymentUrl: 'https://pay.payos.vn/web/checkout',
    });
  });

  it('rejects untrusted PayOS checkout URLs and cleans up pending subscriptions', async () => {
    vi.mocked(Plan.findById).mockResolvedValue({
      _id: 'premium',
      name: 'Premium',
      price: 99000,
      duration: 'P1M',
      features: [],
      isActive: true,
    } as any);

    const { service, subscriptionRepository } = createService({
      userRepository: {
        findById: vi.fn().mockResolvedValue({
          email: 'user@example.com',
          name: 'User',
          subscription: { isActive: false },
        }),
      },
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue(null),
      },
      payosService: {
        createPayment: vi.fn().mockResolvedValue({
          code: '00',
          data: {
            checkoutUrl: 'https://evil.example/checkout',
          },
        }),
      },
    });

    await expect(service.createPaymentRequest('user-1', 'premium')).rejects.toThrow(
      'Received an invalid payment redirect URL',
    );
    expect(subscriptionRepository.deleteByOrderId).toHaveBeenCalledWith(expect.any(String));
  });

  it('detects free, inactive, active, and lifetime premium states', async () => {
    const { service, userRepository } = createService();

    userRepository.findById.mockResolvedValueOnce({});
    await expect(service.isUserPremium('user-1')).resolves.toBe(false);

    userRepository.findById.mockResolvedValueOnce({
      subscription: { isActive: false, endDate: new Date('2099-01-01T00:00:00Z') },
    });
    await expect(service.isUserPremium('user-1')).resolves.toBe(false);

    userRepository.findById.mockResolvedValueOnce({
      subscription: { isActive: true, endDate: new Date('2099-01-01T00:00:00Z') },
    });
    await expect(service.isUserPremium('user-1')).resolves.toBe(true);

    userRepository.findById.mockResolvedValueOnce({
      subscription: { isActive: true },
    });
    await expect(service.isUserPremium('user-1')).resolves.toBe(true);
  });

  it('rejects payment creation for missing users and existing premium users', async () => {
    const { service, subscriptionRepository } = createService({
      userRepository: {
        findById: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            email: 'user@example.com',
            subscription: { isActive: true },
          })
          .mockResolvedValueOnce({
            email: 'user@example.com',
            subscription: { isActive: true },
          }),
      },
    });

    await expect(service.createPaymentRequest('missing-user', 'premium')).rejects.toThrow(
      'User not found',
    );

    vi.mocked(Plan.findById).mockResolvedValue({
      name: 'Premium',
      price: 99000,
      isActive: true,
    } as any);
    await expect(service.createPaymentRequest('user-1', 'premium')).rejects.toThrow(
      'User already has an active subscription',
    );
    expect(subscriptionRepository.create).not.toHaveBeenCalled();
  });

  it('rejects PayOS responses without checkout URLs', async () => {
    vi.mocked(Plan.findById).mockResolvedValue({
      name: 'Premium',
      price: 99000,
      isActive: true,
    } as any);

    const { service } = createService({
      userRepository: {
        findById: vi.fn().mockResolvedValue({
          email: 'user@example.com',
          subscription: { isActive: false },
        }),
      },
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue(null),
      },
      payosService: {
        createPayment: vi.fn().mockResolvedValue({ code: '00', data: {} }),
      },
    });

    await expect(service.createPaymentRequest('user-1', 'premium')).rejects.toThrow(
      'Payment URL not received from PayOS',
    );
  });

  it('cleans up pending subscriptions when PayOS creation fails', async () => {
    vi.mocked(Plan.findById).mockResolvedValue({
      name: 'Premium',
      price: 99000,
      isActive: true,
    } as any);

    const { service, subscriptionRepository } = createService({
      userRepository: {
        findById: vi.fn().mockResolvedValue({
          email: 'user@example.com',
          subscription: { isActive: false },
        }),
      },
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue(null),
      },
      payosService: {
        createPayment: vi.fn().mockResolvedValue({
          code: '99',
          desc: 'PayOS down',
        }),
      },
    });

    await expect(service.createPaymentRequest('user-1', 'premium')).rejects.toThrow('PayOS down');
    expect(subscriptionRepository.create).toHaveBeenCalledOnce();
    expect(subscriptionRepository.deleteByOrderId).toHaveBeenCalledWith(expect.any(String));
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

  it('rejects completed verification if the stored subscription is expired', async () => {
    const { service } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          user: { toString: () => 'user-1' },
          status: 'completed',
          endDate: new Date('2025-01-01T00:00:00Z'),
        }),
      },
    });

    await expect(service.verifyAndActivateSubscription(123, 'user-1')).rejects.toThrow(
      'Subscription already expired',
    );
  });

  it('rejects non-pending verification statuses before calling PayOS', async () => {
    const { service, payosService } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          user: { toString: () => 'user-1' },
          status: 'cancelled',
        }),
      },
    });

    await expect(service.verifyAndActivateSubscription(123, 'user-1')).rejects.toThrow(
      'Cannot verify subscription with status cancelled',
    );
    expect(payosService.verifyPayment).not.toHaveBeenCalled();
  });

  it('rejects unpaid PayOS verification responses', async () => {
    const { service } = createService({
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
            status: 'PENDING',
            orderCode: '123',
            amount: 99000,
          },
        }),
      },
    });

    await expect(service.verifyAndActivateSubscription(123, 'user-1')).rejects.toThrow(
      'Payment not completed',
    );
  });

  it('rejects PayOS verification failures and order mismatches', async () => {
    const { service, payosService } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          user: { toString: () => 'user-1' },
          type: 'premium',
          amount: 99000,
          status: 'pending',
        }),
      },
      payosService: {
        verifyPayment: vi
          .fn()
          .mockResolvedValueOnce({ code: '99', desc: 'bad payment' })
          .mockResolvedValueOnce({
            code: '00',
            data: { status: 'PAID', orderCode: '999', amount: 99000 },
          }),
      },
    });

    await expect(service.verifyAndActivateSubscription(123, 'user-1')).rejects.toThrow(
      'bad payment',
    );
    await expect(service.verifyAndActivateSubscription(123, 'user-1')).rejects.toThrow(
      'Payment order code mismatch',
    );
    expect(payosService.verifyPayment).toHaveBeenCalledTimes(2);
  });

  it('keeps completed webhook activation idempotent and rejects invalid webhook states', async () => {
    const { service, subscriptionRepository } = createService({
      subscriptionRepository: {
        findByOrderId: vi
          .fn()
          .mockResolvedValueOnce({
            type: 'premium',
            status: 'completed',
            startDate: new Date('2026-01-01T00:00:00Z'),
            endDate: new Date('2026-02-01T00:00:00Z'),
            isActive: true,
          })
          .mockResolvedValueOnce({ status: 'cancelled' })
          .mockResolvedValueOnce({ status: 'pending', amount: 99000 })
          .mockResolvedValueOnce({ status: 'pending', amount: 99000 })
          .mockResolvedValueOnce({ status: 'pending', amount: 99000 })
          .mockResolvedValueOnce({ status: 'pending', amount: 99000 }),
      },
    });

    await expect(
      service.activateVerifiedSubscription(123, { orderCode: 123, amount: 99000 }),
    ).resolves.toMatchObject({ success: true, subscription: { isActive: true } });
    await expect(
      service.activateVerifiedSubscription(123, { orderCode: 123, amount: 99000 }),
    ).rejects.toThrow('Cannot activate subscription with status cancelled');
    await expect(
      service.activateVerifiedSubscription(123, { orderCode: 999, amount: 99000 }),
    ).rejects.toThrow('Payment order code mismatch');
    await expect(
      service.activateVerifiedSubscription(123, { orderCode: 123, amount: 1 }),
    ).rejects.toThrow('Payment amount mismatch');
    await expect(
      service.activateVerifiedSubscription(123, {
        orderCode: 123,
        amount: 99000,
        status: 'PENDING',
      }),
    ).rejects.toThrow('Payment not completed');
    await expect(
      service.activateVerifiedSubscription(123, { orderCode: 123, amount: 99000, code: '99' }),
    ).rejects.toThrow('Payment not successful');
    expect(subscriptionRepository.updateByOrderId).not.toHaveBeenCalled();
  });

  it('rejects activation when the stored plan is missing', async () => {
    vi.mocked(Plan.findById).mockResolvedValue(null);
    const { service } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          user: { toString: () => 'user-1' },
          type: 'missing-plan',
          amount: 99000,
          status: 'pending',
        }),
      },
    });

    await expect(
      service.activateVerifiedSubscription(123, { orderCode: 123, amount: 99000 }),
    ).rejects.toThrow('Plan not found');
  });

  it('uses legacy duration fallback for old monthly plans', async () => {
    vi.mocked(Plan.findById).mockResolvedValue({
      name: 'Legacy 6 Months',
      durationInfo: { iso8601: 'legacy' },
      duration: '6 months',
    } as any);

    const { service, subscriptionRepository, userRepository } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          user: { toString: () => 'user-1' },
          type: 'legacy-plan',
          amount: 99000,
          status: 'pending',
        }),
      },
    });

    const result = await service.activateVerifiedSubscription(123, {
      orderCode: 123,
      amount: 99000,
      status: 'PAID',
    });

    expect(result.subscription.endDate).toBeInstanceOf(Date);
    expect(subscriptionRepository.updateByOrderId).toHaveBeenCalledWith(
      '123',
      expect.objectContaining({ endDate: expect.any(Date) }),
    );
    expect(userRepository.updateById).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        subscription: expect.objectContaining({ endDate: expect.any(Date) }),
      }),
    );
  });

  it('cancels active time-limited subscriptions and deactivates active records', async () => {
    const { service, subscriptionRepository, userRepository } = createService({
      userRepository: {
        findById: vi.fn().mockResolvedValue({
          subscription: { endDate: new Date('2099-01-01T00:00:00Z') },
        }),
      },
      subscriptionRepository: {
        findByUser: vi.fn().mockResolvedValue([
          {
            _id: { toString: () => 'sub-1' },
            status: 'completed',
            isActive: true,
          },
        ]),
      },
    });

    await expect(service.cancelSubscription('user-1')).resolves.toEqual({ success: true });
    expect(userRepository.updateById).toHaveBeenCalledWith('user-1', {
      'subscription.isActive': false,
    });
    expect(subscriptionRepository.updateById).toHaveBeenCalledWith('sub-1', { isActive: false });
  });

  it('rejects cancellation when there is no time-limited subscription', async () => {
    const { service } = createService({
      userRepository: {
        findById: vi.fn().mockResolvedValue({ subscription: { isActive: true } }),
      },
    });

    await expect(service.cancelSubscription('user-1')).rejects.toThrow(
      'Only time-limited subscriptions can be cancelled',
    );
  });

  it('rejects cancellation for missing users', async () => {
    const { service } = createService({
      userRepository: {
        findById: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(service.cancelSubscription('missing-user')).rejects.toThrow('User not found');
  });

  it('returns active plans and handles plan fetch failures', async () => {
    vi.mocked(Plan.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        {
          _id: { toString: () => 'premium' },
          name: 'Premium',
          price: 99000,
          duration: 'P1M',
          features: ['Feature'],
        },
      ]),
    } as any);
    const { service } = createService();

    await expect(service.getSubscriptionPlans()).resolves.toEqual([
      {
        id: 'premium',
        name: 'Premium',
        price: 99000,
        duration: 'P1M',
        features: ['Feature'],
      },
    ]);

    vi.mocked(Plan.find).mockImplementation(() => {
      throw new Error('db down');
    });
    await expect(service.getSubscriptionPlans()).resolves.toEqual([]);
  });

  it('sanitizes admin subscription updates', async () => {
    const { service, subscriptionRepository, userRepository } = createService({
      subscriptionRepository: {
        updateById: vi.fn().mockResolvedValue({ _id: 'sub-1' }),
        findById: vi.fn().mockResolvedValue({ user: { toString: () => 'user-1' } }),
      },
    });

    await expect(service.updateSubscriptionById('sub-1', { status: 'completed' })).resolves.toEqual(
      {
        success: true,
        data: { _id: 'sub-1' },
      },
    );
    expect(subscriptionRepository.updateById).toHaveBeenCalledWith('sub-1', {
      status: 'completed',
      isActive: true,
    });
    expect(userRepository.updateById).toHaveBeenCalledWith('user-1', {
      'subscription.isActive': true,
    });

    await expect(
      service.updateSubscriptionById('sub-1', { status: 'bad' as never }),
    ).resolves.toEqual({
      success: false,
      error: 'Invalid subscription status',
      statusCode: 400,
    });
    await expect(service.updateSubscriptionById('sub-1', { foo: 'bar' } as never)).resolves.toEqual(
      {
        success: false,
        error: 'No valid subscription fields provided',
        statusCode: 400,
      },
    );
  });

  it('returns safe errors for missing or failing admin subscription updates', async () => {
    const { service, subscriptionRepository } = createService({
      subscriptionRepository: {
        updateById: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockRejectedValueOnce(new Error('database unavailable')),
      },
    });

    await expect(service.updateSubscriptionById('missing', { isActive: false })).resolves.toEqual({
      success: false,
      error: 'Subscription not found',
      statusCode: 404,
    });
    await expect(service.updateSubscriptionById('sub-1', { isActive: false })).resolves.toEqual({
      success: false,
      error: 'database unavailable',
      statusCode: 500,
    });
    expect(subscriptionRepository.updateById).toHaveBeenCalledTimes(2);
  });

  it('fails order-code generation after repeated collisions', async () => {
    vi.mocked(Plan.findById).mockResolvedValue({
      name: 'Premium',
      price: 99000,
      isActive: true,
    } as any);
    const { service } = createService({
      userRepository: {
        findById: vi.fn().mockResolvedValue({
          email: 'user@example.com',
          subscription: { isActive: false },
        }),
      },
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({ _id: 'existing-order' }),
      },
    });

    await expect(service.createPaymentRequest('user-1', 'premium')).rejects.toThrow(
      'Failed to generate unique payment order code',
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
