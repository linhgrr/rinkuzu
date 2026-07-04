import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';

import { SubscriptionService } from './SubscriptionService';
import type { BillingPlan } from '@/entities/AdminBilling';
import type { SubscriptionRecord } from '@/entities/Subscription';
import type { ISubscriptionRepository } from '@/interfaces/repositories/ISubscriptionRepository';
import type { ISubscriptionPlanRepository } from '@/interfaces/repositories/ISubscriptionPlanRepository';
import type { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import type { IPayOSService, PayOSPaymentLinkData } from '@/interfaces/services/IPayOSService';

interface ServiceOverrides {
  subscriptionRepository?: Partial<Mocked<ISubscriptionRepository>>;
  userRepository?: Partial<Mocked<IUserRepository>>;
  payosService?: Partial<Mocked<IPayOSService>>;
  planRepository?: Partial<Mocked<ISubscriptionPlanRepository>>;
}

function billingPlan(overrides: Partial<BillingPlan> = {}): BillingPlan {
  const now = new Date('2026-01-01T00:00:00Z');
  return {
    id: 'premium',
    name: 'Premium',
    price: 99000,
    duration: 'P1M',
    features: [],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function subscriptionFixture(overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
  const now = new Date('2026-01-01T00:00:00Z');
  return {
    id: 'sub-1',
    userId: 'user-1',
    userEmail: 'user@example.com',
    type: 'premium',
    amount: 99_000,
    currency: 'VND',
    status: 'completed',
    payosOrderId: 'order-1',
    startDate: now,
    endDate: new Date('2026-02-01T00:00:00Z'),
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function payosPaymentLinkData(overrides: Partial<PayOSPaymentLinkData> = {}): PayOSPaymentLinkData {
  return {
    id: 'payment-link-id',
    orderCode: 123,
    amount: 99000,
    amountPaid: 99000,
    amountRemaining: 0,
    status: 'PAID',
    createdAt: '2026-07-02T04:00:00.000Z',
    transactions: [
      {
        reference: 'payos-transaction-reference',
        amount: 99000,
        accountNumber: '113366668888',
        description: 'ORDER 123',
        transactionDateTime: '2026-07-02 11:00:00',
        virtualAccountName: null,
        virtualAccountNumber: null,
        counterAccountBankId: null,
        counterAccountBankName: null,
        counterAccountName: null,
        counterAccountNumber: null,
      },
    ],
    cancellationReason: null,
    canceledAt: null,
    ...overrides,
  };
}

function createService(overrides: ServiceOverrides = {}) {
  const subscriptionRepository: Mocked<ISubscriptionRepository> = {
    create: vi.fn(),
    findById: vi.fn(),
    findByOrderId: vi.fn(),
    findByUser: vi.fn(),
    findByTransactionReference: vi.fn().mockResolvedValue(null),
    expireDue: vi.fn().mockResolvedValue(0),
    updateAdminStatusById: vi.fn(),
    expireCurrentForUser: vi.fn(),
    cancelCurrentForUser: vi.fn(),
    updateById: vi.fn(),
    updateByOrderId: vi.fn(),
    activateSubscription: vi.fn().mockResolvedValue(undefined),
    deletePendingByOrderId: vi.fn(),
    findWithPagination: vi.fn(),
    ...overrides.subscriptionRepository,
  };
  const userRepository: Mocked<IUserRepository> = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    findSubscriptionById: vi.fn(),
    findPublicProfileById: vi.fn(),
    updateRole: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn(),
    count: vi.fn(),
    countByCreatedAtBuckets: vi.fn(),
    countByRole: vi.fn(),
    ...overrides.userRepository,
  };
  const payosService: Mocked<IPayOSService> = {
    createPayment: vi.fn(),
    verifyPayment: vi.fn(),
    getPaymentInfo: vi.fn(),
    testConnection: vi.fn(),
    ...overrides.payosService,
  };
  const planRepository: Mocked<ISubscriptionPlanRepository> = {
    findById: vi.fn().mockResolvedValue(billingPlan()),
    findActiveById: vi.fn().mockResolvedValue(billingPlan()),
    listActive: vi.fn().mockResolvedValue([]),
    ...overrides.planRepository,
  };

  return {
    subscriptionRepository,
    userRepository,
    payosService,
    planRepository,
    service: new SubscriptionService(
      subscriptionRepository,
      userRepository,
      payosService,
      planRepository,
    ),
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
          userId: 'owner-user',
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
    const { service, subscriptionRepository, payosService } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          userId: 'user-1',
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
  });

  it('rejects PayOS amount mismatches before activation', async () => {
    const { service, subscriptionRepository, payosService } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          userId: 'user-1',
          type: 'premium',
          amount: 99000,
          status: 'pending',
        }),
      },
      payosService: {
        verifyPayment: vi.fn().mockResolvedValue({
          code: '00',
          desc: 'success',
          data: payosPaymentLinkData({ amount: 1000 }),
        }),
      },
    });

    await expect(service.verifyAndActivateSubscription(123, 'user-1')).rejects.toThrow(
      'Payment amount mismatch',
    );
    expect(subscriptionRepository.updateByOrderId).not.toHaveBeenCalled();
    expect(payosService.verifyPayment).toHaveBeenCalledWith(123);
  });

  it('does not create payments for inactive plans', async () => {
    const { service, subscriptionRepository } = createService({
      userRepository: {
        findById: vi.fn().mockResolvedValue({ email: 'user@example.com' }),
      },
      planRepository: {
        findActiveById: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(service.createPaymentRequest('user-1', 'inactive-plan')).rejects.toThrow(
      'Invalid subscription plan',
    );
    expect(subscriptionRepository.create).not.toHaveBeenCalled();
  });

  it('creates payment requests and stores PayOS checkout URLs', async () => {
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
      planRepository: {
        findActiveById: vi
          .fn()
          .mockResolvedValue(
            billingPlan({ name: 'Premium plan name that is longer than PayOS allows' }),
          ),
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
    expect(subscriptionRepository.deletePendingByOrderId).toHaveBeenCalledWith(expect.any(String));
  });

  it('detects free, inactive, active, and lifetime premium states', async () => {
    const { service, userRepository } = createService();

    userRepository.findSubscriptionById.mockResolvedValueOnce(null);
    await expect(service.isUserPremium('user-1')).resolves.toBe(false);

    userRepository.findSubscriptionById.mockResolvedValueOnce({
      type: 'premium',
      isActive: false,
      endDate: new Date('2099-01-01T00:00:00Z'),
    });
    await expect(service.isUserPremium('user-1')).resolves.toBe(false);

    userRepository.findSubscriptionById.mockResolvedValueOnce({
      type: 'premium',
      isActive: true,
      endDate: new Date('2099-01-01T00:00:00Z'),
    });
    await expect(service.isUserPremium('user-1')).resolves.toBe(true);

    userRepository.findSubscriptionById.mockResolvedValueOnce({
      type: 'premium',
      isActive: true,
    });
    await expect(service.isUserPremium('user-1')).resolves.toBe(true);

    expect(userRepository.findSubscriptionById).toHaveBeenCalledTimes(4);
    expect(userRepository.findById).not.toHaveBeenCalled();
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

    await expect(service.createPaymentRequest('user-1', 'premium')).rejects.toThrow(
      'User already has an active subscription',
    );
    expect(subscriptionRepository.create).not.toHaveBeenCalled();
  });

  it('rejects PayOS responses without checkout URLs', async () => {
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
    expect(subscriptionRepository.deletePendingByOrderId).toHaveBeenCalledWith(expect.any(String));
  });

  it('activates webhook-verified payments with the stored plan duration', async () => {
    const { service, subscriptionRepository } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          userId: 'user-1',
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
    expect(subscriptionRepository.activateSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: '123',
        userId: 'user-1',
        type: 'premium',
        startDate: expect.any(Date),
        endDate: expect.any(Date),
        transactionReference: 'payos-ref',
      }),
    );
  });

  it('rejects completed verification if the stored subscription is expired', async () => {
    const { service } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          userId: 'user-1',
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
          userId: 'user-1',
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
          userId: 'user-1',
          type: 'premium',
          amount: 99000,
          status: 'pending',
        }),
      },
      payosService: {
        verifyPayment: vi.fn().mockResolvedValue({
          code: '00',
          desc: 'success',
          data: payosPaymentLinkData({
            status: 'PENDING',
            amountPaid: 0,
            amountRemaining: 99000,
            transactions: [],
          }),
        }),
      },
    });

    await expect(service.verifyAndActivateSubscription(123, 'user-1')).rejects.toThrow(
      'Payment not completed',
    );
  });

  it('rejects successful PayOS envelopes without payment data', async () => {
    const { service } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          userId: 'user-1',
          type: 'premium',
          amount: 99000,
          status: 'pending',
        }),
      },
      payosService: {
        verifyPayment: vi.fn().mockResolvedValue({
          code: '00',
          desc: 'success',
          data: null,
        }),
      },
    });

    await expect(service.verifyAndActivateSubscription(123, 'user-1')).rejects.toThrow(
      'PayOS response missing payment data',
    );
  });

  it('rejects paid PayOS links without a transaction reference', async () => {
    const { service } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          userId: 'user-1',
          type: 'premium',
          amount: 99000,
          status: 'pending',
        }),
      },
      payosService: {
        verifyPayment: vi.fn().mockResolvedValue({
          code: '00',
          desc: 'success',
          data: payosPaymentLinkData({ transactions: [] }),
        }),
      },
    });

    await expect(service.verifyAndActivateSubscription(123, 'user-1')).rejects.toThrow(
      'Paid PayOS response missing transaction reference',
    );
  });

  it('rejects PayOS verification failures and order mismatches', async () => {
    const { service, payosService } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          userId: 'user-1',
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
            desc: 'success',
            data: payosPaymentLinkData({ orderCode: 999 }),
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
    const { service } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          userId: 'user-1',
          type: 'missing-plan',
          amount: 99000,
          status: 'pending',
        }),
      },
      planRepository: {
        findById: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(
      service.activateVerifiedSubscription(123, { orderCode: 123, amount: 99000 }),
    ).rejects.toThrow('Plan not found');
  });

  it('rejects activation when a stored plan violates the ISO duration contract', async () => {
    const { service } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          userId: 'user-1',
          type: 'invalid-plan',
          amount: 99000,
          status: 'pending',
        }),
      },
      planRepository: {
        findById: vi
          .fn()
          .mockResolvedValue(billingPlan({ name: 'Invalid plan', duration: '6 months' })),
      },
    });

    await expect(
      service.activateVerifiedSubscription(123, {
        orderCode: 123,
        amount: 99000,
        status: 'PAID',
      }),
    ).rejects.toThrow('Unsupported ISO 8601 duration format');
  });

  it('cancels active time-limited subscriptions and deactivates active records', async () => {
    const { service, subscriptionRepository } = createService({
      subscriptionRepository: {
        cancelCurrentForUser: vi.fn().mockResolvedValue({ outcome: 'cancelled' }),
      },
    });

    await expect(service.cancelSubscription('user-1')).resolves.toEqual({ success: true });
    expect(subscriptionRepository.cancelCurrentForUser).toHaveBeenCalledWith('user-1');
  });

  it('rejects cancellation when there is no time-limited subscription', async () => {
    const { service } = createService({
      subscriptionRepository: {
        cancelCurrentForUser: vi.fn().mockResolvedValue({ outcome: 'not_time_limited' }),
      },
    });

    await expect(service.cancelSubscription('user-1')).rejects.toThrow(
      'Only time-limited subscriptions can be cancelled',
    );
  });

  it('rejects cancellation for missing users', async () => {
    const { service } = createService({
      subscriptionRepository: {
        cancelCurrentForUser: vi.fn().mockResolvedValue({ outcome: 'user_not_found' }),
      },
    });

    await expect(service.cancelSubscription('missing-user')).rejects.toThrow('User not found');
  });

  it('rejects cancellation when embedded and persisted subscriptions diverge', async () => {
    const { service } = createService({
      subscriptionRepository: {
        cancelCurrentForUser: vi.fn().mockResolvedValue({ outcome: 'inconsistent_record' }),
      },
    });

    await expect(service.cancelSubscription('user-1')).rejects.toThrow(
      'Current subscription record is inconsistent',
    );
  });

  it('returns active plans and handles plan fetch failures', async () => {
    const { service, planRepository } = createService({
      planRepository: {
        listActive: vi.fn().mockResolvedValue([billingPlan({ features: ['Feature'] })]),
      },
    });

    await expect(service.getSubscriptionPlans()).resolves.toEqual([
      {
        id: 'premium',
        name: 'Premium',
        price: 99000,
        duration: 'P1M',
        features: ['Feature'],
      },
    ]);

    planRepository.listActive.mockRejectedValue(new Error('db down'));
    await expect(service.getSubscriptionPlans()).resolves.toEqual([]);
  });

  it('delegates valid admin status transitions to the transactional repository method', async () => {
    const updated = subscriptionFixture({ status: 'cancelled', isActive: false });
    const { service, subscriptionRepository } = createService({
      subscriptionRepository: {
        updateAdminStatusById: vi.fn().mockResolvedValue({
          outcome: 'updated',
          subscription: updated,
        }),
      },
    });

    await expect(service.updateSubscriptionById('sub-1', { status: 'cancelled' })).resolves.toEqual(
      {
        success: true,
        data: {
          id: updated.id,
          user: updated.userId,
          userEmail: updated.userEmail,
          type: updated.type,
          amount: updated.amount,
          currency: updated.currency,
          status: updated.status,
          payosOrderId: updated.payosOrderId,
          payosTransactionId: updated.payosTransactionId,
          payosPaymentUrl: updated.payosPaymentUrl,
          startDate: updated.startDate?.toISOString(),
          endDate: updated.endDate?.toISOString(),
          isActive: updated.isActive,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
      },
    );
    expect(subscriptionRepository.updateAdminStatusById).toHaveBeenCalledWith('sub-1', 'cancelled');
  });

  it('returns explicit errors for missing and invalid admin subscription transitions', async () => {
    const { service, subscriptionRepository } = createService({
      subscriptionRepository: {
        updateAdminStatusById: vi
          .fn()
          .mockResolvedValueOnce({ outcome: 'not_found' })
          .mockResolvedValueOnce({
            outcome: 'invalid_transition',
            currentStatus: 'cancelled',
          }),
      },
    });

    await expect(
      service.updateSubscriptionById('missing', { status: 'cancelled' }),
    ).resolves.toEqual({
      success: false,
      error: 'Subscription not found',
      statusCode: 404,
    });
    await expect(service.updateSubscriptionById('sub-1', { status: 'expired' })).resolves.toEqual({
      success: false,
      error: 'Cannot change subscription status from cancelled to expired',
      statusCode: 409,
    });
    expect(subscriptionRepository.updateAdminStatusById).toHaveBeenCalledTimes(2);
  });

  it('fails order-code generation after repeated collisions', async () => {
    const { service } = createService({
      userRepository: {
        findById: vi.fn().mockResolvedValue({
          email: 'user@example.com',
          subscription: { isActive: false },
        }),
      },
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({ id: 'existing-order' }),
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
        findSubscriptionById: vi.fn().mockResolvedValue({
          type: 'premium_6months',
          isActive: true,
          endDate: expiredEndDate,
          payosOrderId: 'order-1',
        }),
      },
      subscriptionRepository: {
        expireCurrentForUser: vi.fn().mockResolvedValue(true),
      },
    });

    const subscription = await service.getSubscriptionStatus('user-1');

    expect(subscription).toEqual({
      subscription: null,
      isPremium: false,
    });
    expect(userRepository.findById).not.toHaveBeenCalled();
    expect(subscriptionRepository.expireCurrentForUser).toHaveBeenCalledWith('user-1', 'order-1');
  });

  it('expires both subscription records and stale embedded user subscriptions in cron checks', async () => {
    const { service, subscriptionRepository } = createService({
      subscriptionRepository: {
        expireDue: vi.fn().mockResolvedValue(2),
      },
    });

    const updatedCount = await service.checkAndUpdateExpiredSubscriptions();

    expect(updatedCount).toBe(2);
    expect(subscriptionRepository.expireDue).toHaveBeenCalledWith(expect.any(Date));
  });

  it('returns the stored snapshot when the PayOS transaction was already activated', async () => {
    const existingSnapshot = {
      type: 'premium',
      status: 'completed',
      startDate: new Date('2099-01-01T00:00:00Z'),
      endDate: new Date('2099-02-01T00:00:00Z'),
      isActive: true,
      createdAt: new Date('2099-01-01T00:00:00Z'),
    };

    const { service, subscriptionRepository } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          userId: 'user-1',
          type: 'premium',
          amount: 99000,
          status: 'pending',
        }),
        findByTransactionReference: vi.fn().mockResolvedValue(existingSnapshot),
      },
    });

    const result = await service.activateVerifiedSubscription(123, {
      orderCode: '123',
      amount: 99000,
      reference: 'duplicate-ref',
      status: 'PAID',
      code: '00',
    });

    expect(result).toEqual({
      success: true,
      subscription: {
        type: 'premium',
        startDate: existingSnapshot.startDate,
        endDate: existingSnapshot.endDate,
        isActive: true,
      },
    });
    expect(subscriptionRepository.activateSubscription).not.toHaveBeenCalled();
  });

  it('recovers from concurrent activation duplicate-key errors', async () => {
    const settledSnapshot = {
      type: 'premium',
      status: 'completed',
      startDate: new Date('2099-03-01T00:00:00Z'),
      endDate: new Date('2099-04-01T00:00:00Z'),
      isActive: true,
      createdAt: new Date('2099-03-01T00:00:00Z'),
    };

    const dupError = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });

    const { service } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          userId: 'user-1',
          type: 'premium',
          amount: 99000,
          status: 'pending',
        }),
        findByTransactionReference: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(settledSnapshot),
        activateSubscription: vi.fn().mockRejectedValue(dupError),
      },
    });

    const result = await service.activateVerifiedSubscription(456, {
      orderCode: '456',
      amount: 99000,
      reference: 'concurrent-ref',
      status: 'PAID',
      code: '00',
    });

    expect(result.success).toBe(true);
    expect(result.subscription.endDate).toEqual(settledSnapshot.endDate);
  });

  it('rethrows non-duplicate transaction failures during activation', async () => {
    const { service } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          userId: 'user-1',
          type: 'premium',
          amount: 99000,
          status: 'pending',
        }),
        findByTransactionReference: vi.fn().mockResolvedValue(null),
        activateSubscription: vi.fn().mockRejectedValue(new Error('mongo unreachable')),
      },
    });

    await expect(
      service.activateVerifiedSubscription(789, {
        orderCode: '789',
        amount: 99000,
        reference: 'failure-ref',
        status: 'PAID',
        code: '00',
      }),
    ).rejects.toThrow('mongo unreachable');
  });
});
