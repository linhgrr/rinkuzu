import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import crypto from 'crypto';

const { invalidateEntitlementsMock } = vi.hoisted(() => ({
  invalidateEntitlementsMock: vi.fn(),
}));

vi.mock('@/lib/entitlements/cache', () => ({
  invalidateEntitlements: invalidateEntitlementsMock,
}));

import { SubscriptionService } from './SubscriptionService';
import type { BillingPlan } from '@/entities/AdminBilling';
import {
  SubscriptionActivationConflictError,
  type SubscriptionRecord,
} from '@/entities/Subscription';
import type { ISubscriptionRepository } from '@/interfaces/repositories/ISubscriptionRepository';
import type { ISubscriptionPlanRepository } from '@/interfaces/repositories/ISubscriptionPlanRepository';
import type { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import type { IPayOSService, PayOSVerifyResponse } from '@/interfaces/services/IPayOSService';

type PayOSPaymentLinkData = NonNullable<PayOSVerifyResponse['data']>;

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
    planId: 'premium',
    planName: 'Premium',
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
    findByTransactionReference: vi.fn().mockResolvedValue(null),
    expireDue: vi.fn().mockResolvedValue({ count: 0, userIds: [] }),
    updateAdminStatusById: vi.fn(),
    expireCurrentForUser: vi.fn(),
    cancelCurrentForUser: vi.fn(),
    updateById: vi.fn(),
    updateByOrderId: vi.fn(),
    settlePendingPayment: vi.fn(),
    activateSubscription: vi.fn().mockResolvedValue(undefined),
    ...overrides.subscriptionRepository,
  };
  const userRepository: Mocked<IUserRepository> = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    findByIdIncludingDisabled: vi.fn(),
    findSubscriptionById: vi.fn(),
    findPublicProfileById: vi.fn(),
    applyAdminMutation: vi.fn(),
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
    invalidateEntitlementsMock.mockReset();
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
          planId: 'premium',
          planName: 'Premium',
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
    // Idempotent successful state: still drop a possibly stale free-tier cache.
    expect(invalidateEntitlementsMock).toHaveBeenCalledExactlyOnceWith('user-1');
  });

  it('rejects PayOS amount mismatches before activation', async () => {
    const { service, subscriptionRepository, payosService } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          userId: 'user-1',
          planId: 'premium',
          planName: 'Premium',
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
    expect(invalidateEntitlementsMock).not.toHaveBeenCalled();
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

    expect(result).toEqual({
      orderCode: expect.any(Number),
      paymentUrl: 'https://pay.payos.vn/web/checkout',
      qrCode: 'qr-code',
      amount: 99000,
      plan: {
        id: 'premium',
        name: 'Premium plan name that is longer than PayOS allows',
        price: 99000,
        duration: 'P1M',
      },
    });
    expect(subscriptionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userEmail: 'user@example.com',
        planId: 'premium',
        planName: 'Premium plan name that is longer than PayOS allows',
        amount: 99000,
        currency: 'VND',
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

  it('rejects untrusted PayOS checkout URLs while preserving the pending order', async () => {
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
    expect(subscriptionRepository.create).toHaveBeenCalledOnce();
  });

  it('detects free, inactive, active, and anomalous premium states', async () => {
    const { service, userRepository, subscriptionRepository } = createService({
      subscriptionRepository: {
        expireCurrentForUser: vi.fn().mockResolvedValue(true),
      },
    });

    // No subscription → free
    userRepository.findSubscriptionById.mockResolvedValueOnce(null);
    await expect(service.isUserPremium('user-1')).resolves.toBe(false);

    // Inactive with future endDate → not premium
    userRepository.findSubscriptionById.mockResolvedValueOnce({
      planId: 'premium',
      planName: 'Premium',
      isActive: false,
      endDate: new Date('2099-01-01T00:00:00Z'),
    });
    await expect(service.isUserPremium('user-1')).resolves.toBe(false);

    // Active, unexpired endDate → premium
    userRepository.findSubscriptionById.mockResolvedValueOnce({
      planId: 'premium',
      planName: 'Premium',
      isActive: true,
      endDate: new Date('2099-01-01T00:00:00Z'),
    });
    await expect(service.isUserPremium('user-1')).resolves.toBe(true);

    // Active but missing endDate (anomalous) → fail closed
    userRepository.findSubscriptionById.mockResolvedValueOnce({
      planId: 'premium',
      planName: 'Premium',
      isActive: true,
    });
    await expect(service.isUserPremium('user-1')).resolves.toBe(false);

    // Active with invalid endDate → expire path then not premium
    userRepository.findSubscriptionById.mockResolvedValueOnce({
      planId: 'premium',
      planName: 'Premium',
      isActive: true,
      endDate: new Date(Number.NaN),
      payosOrderId: 'order-invalid-end',
    });
    await expect(service.isUserPremium('user-1')).resolves.toBe(false);

    // Active with past endDate → expire path then not premium
    userRepository.findSubscriptionById.mockResolvedValueOnce({
      planId: 'premium',
      planName: 'Premium',
      isActive: true,
      endDate: new Date('2000-01-01T00:00:00.000Z'),
      payosOrderId: 'order-expired',
    });
    await expect(service.isUserPremium('user-1')).resolves.toBe(false);

    expect(userRepository.findSubscriptionById).toHaveBeenCalledTimes(6);
    expect(subscriptionRepository.expireCurrentForUser).toHaveBeenCalledTimes(2);
  });

  it('rejects payment creation for missing users and existing premium users', async () => {
    const { service, subscriptionRepository } = createService({
      userRepository: {
        findById: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            email: 'user@example.com',
            subscription: {
              isActive: true,
              endDate: new Date('2099-01-01T00:00:00.000Z'),
            },
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

  it('does not treat active subscription missing endDate as premium for payment creation', async () => {
    const successfulPayment = {
      code: '00',
      desc: 'success',
      data: {
        checkoutUrl: 'https://pay.payos.vn/web/checkout',
        qrCode: 'qr-code',
      },
    };
    const { service, subscriptionRepository } = createService({
      userRepository: {
        findById: vi.fn().mockResolvedValue({
          email: 'user@example.com',
          name: 'User',
          // Active flag without endDate is anomalous: shared fail-closed helper
          // rejects premium, so payment creation is not blocked as "already active".
          subscription: { planId: 'premium', planName: 'Premium', isActive: true },
        }),
      },
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue(null),
      },
      payosService: {
        createPayment: vi.fn().mockResolvedValue(successfulPayment),
      },
    });

    await expect(service.createPaymentRequest('user-1', 'premium')).resolves.toMatchObject({
      paymentUrl: 'https://pay.payos.vn/web/checkout',
    });
    expect(subscriptionRepository.create).toHaveBeenCalledOnce();
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

  it('settles pending subscriptions when PayOS explicitly rejects creation', async () => {
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
    expect(subscriptionRepository.settlePendingPayment).toHaveBeenCalledWith(
      expect.any(String),
      'user-1',
      'failed',
    );
  });

  it('activates webhook-verified payments with the stored plan duration', async () => {
    const { service, subscriptionRepository } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          userId: 'user-1',
          planId: 'premium',
          planName: 'Premium',
          amount: 99000,
          status: 'pending',
        }),
      },
    });

    const result = await service.activateVerifiedSubscription(123, {
      orderCode: 123,
      amount: 99000,
      reference: 'payos-ref',
    });

    expect(result.success).toBe(true);
    expect(subscriptionRepository.activateSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: '123',
        userId: 'user-1',
        planId: 'premium',
        planName: 'Premium',
        startDate: expect.any(Date),
        endDate: expect.any(Date),
        transactionReference: 'payos-ref',
      }),
    );
    expect(invalidateEntitlementsMock).toHaveBeenCalledExactlyOnceWith('user-1');
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
          planId: 'premium',
          planName: 'Premium',
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
          planId: 'premium',
          planName: 'Premium',
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
          planId: 'premium',
          planName: 'Premium',
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
          planId: 'premium',
          planName: 'Premium',
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

  it('keeps completed webhook activation idempotent and rejects invalid event invariants', async () => {
    const { service, subscriptionRepository } = createService({
      subscriptionRepository: {
        findByOrderId: vi
          .fn()
          .mockResolvedValueOnce(
            subscriptionFixture({
              payosOrderId: '123',
              startDate: new Date('2026-01-01T00:00:00Z'),
              endDate: new Date('2026-02-01T00:00:00Z'),
            }),
          )
          .mockResolvedValueOnce(subscriptionFixture({ status: 'cancelled' }))
          .mockResolvedValueOnce(subscriptionFixture({ status: 'pending' }))
          .mockResolvedValueOnce(subscriptionFixture({ status: 'pending' }))
          .mockResolvedValueOnce(subscriptionFixture({ status: 'pending' })),
      },
    });

    await expect(
      service.activateVerifiedSubscription(123, {
        orderCode: 123,
        amount: 99000,
        reference: 'completed-ref',
      }),
    ).resolves.toMatchObject({ success: true, subscription: { isActive: true } });
    await expect(
      service.activateVerifiedSubscription(123, {
        orderCode: 123,
        amount: 99000,
        reference: 'cancelled-ref',
      }),
    ).rejects.toThrow('Cannot activate subscription with status cancelled');
    await expect(
      service.activateVerifiedSubscription(123, {
        orderCode: 999,
        amount: 99000,
        reference: 'wrong-order-ref',
      }),
    ).rejects.toThrow('Payment order code mismatch');
    await expect(
      service.activateVerifiedSubscription(123, {
        orderCode: 123,
        amount: 1,
        reference: 'wrong-amount-ref',
      }),
    ).rejects.toThrow('Payment amount mismatch');
    await expect(
      service.activateVerifiedSubscription(123, {
        orderCode: 123,
        amount: 99000,
        reference: '   ',
      }),
    ).rejects.toThrow('Payment transaction reference is missing');
    expect(subscriptionRepository.updateByOrderId).not.toHaveBeenCalled();
  });

  it('rejects activation when the stored plan is missing', async () => {
    const { service } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          userId: 'user-1',
          planId: 'missing-plan',
          planName: 'Missing plan',
          amount: 99000,
          status: 'pending',
        }),
      },
      planRepository: {
        findById: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(
      service.activateVerifiedSubscription(123, {
        orderCode: 123,
        amount: 99000,
        reference: 'missing-plan-ref',
      }),
    ).rejects.toThrow('Plan not found');
  });

  it('rejects activation when a stored plan violates the ISO duration contract', async () => {
    const { service } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          userId: 'user-1',
          planId: 'invalid-plan',
          planName: 'Invalid plan',
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
        reference: 'invalid-duration-ref',
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
    expect(invalidateEntitlementsMock).toHaveBeenCalledExactlyOnceWith('user-1');
  });

  it('invalidates entitlements on idempotent already-inactive cancellation', async () => {
    const { service } = createService({
      subscriptionRepository: {
        cancelCurrentForUser: vi.fn().mockResolvedValue({ outcome: 'already_inactive' }),
      },
    });

    await expect(service.cancelSubscription('user-1')).resolves.toEqual({ success: true });
    // Authoritative state is inactive; clear a possibly stale premium tier cache.
    expect(invalidateEntitlementsMock).toHaveBeenCalledExactlyOnceWith('user-1');
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
    expect(invalidateEntitlementsMock).not.toHaveBeenCalled();
  });

  it('rejects cancellation for missing users', async () => {
    const { service } = createService({
      subscriptionRepository: {
        cancelCurrentForUser: vi.fn().mockResolvedValue({ outcome: 'user_not_found' }),
      },
    });

    await expect(service.cancelSubscription('missing-user')).rejects.toThrow('User not found');
    expect(invalidateEntitlementsMock).not.toHaveBeenCalled();
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
    expect(invalidateEntitlementsMock).not.toHaveBeenCalled();
  });

  it('returns active plans and propagates plan fetch failures', async () => {
    const { service, planRepository } = createService({
      planRepository: {
        listActive: vi.fn().mockResolvedValue([billingPlan()]),
      },
    });

    await expect(service.getSubscriptionPlans()).resolves.toEqual([
      {
        id: 'premium',
        name: 'Premium',
        price: 99000,
        duration: 'P1M',
      },
    ]);

    planRepository.listActive.mockRejectedValue(new Error('db down'));
    await expect(service.getSubscriptionPlans()).rejects.toThrow('db down');
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
          plan: { id: updated.planId, name: updated.planName },
          amount: updated.amount,
          currency: updated.currency,
          status: updated.status,
          payosOrderId: updated.payosOrderId,
          startDate: updated.startDate?.toISOString(),
          endDate: updated.endDate?.toISOString(),
          isActive: updated.isActive,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
      },
    );
    expect(subscriptionRepository.updateAdminStatusById).toHaveBeenCalledWith('sub-1', 'cancelled');
    expect(invalidateEntitlementsMock).toHaveBeenCalledExactlyOnceWith(updated.userId);
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
    expect(invalidateEntitlementsMock).not.toHaveBeenCalled();
  });

  it('fails order-code generation after repeated collisions', async () => {
    const { service, subscriptionRepository } = createService({
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
    expect(subscriptionRepository.findByOrderId).toHaveBeenCalledTimes(5);
  });

  it('marks expired user subscriptions inactive when reading status', async () => {
    const expiredEndDate = new Date('2025-12-28T00:00:00Z');
    const { service, subscriptionRepository, userRepository } = createService({
      userRepository: {
        findSubscriptionById: vi.fn().mockResolvedValue({
          planId: 'premium_6months',
          planName: 'Premium 6 months',
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

    // Expired snapshots stay in the DTO; isPremium alone controls entitlements.
    expect(subscription).toEqual({
      subscription: {
        plan: { id: 'premium_6months', name: 'Premium 6 months' },
        isActive: false,
        endDate: expiredEndDate.toISOString(),
        status: 'expired',
        payosOrderId: 'order-1',
      },
      isPremium: false,
    });
    expect(userRepository.findById).not.toHaveBeenCalled();
    expect(subscriptionRepository.expireCurrentForUser).toHaveBeenCalledWith('user-1', 'order-1');
    expect(invalidateEntitlementsMock).toHaveBeenCalledExactlyOnceWith('user-1');
  });

  it('reads an already-inactive expired subscription without re-expiring it', async () => {
    // Regression: an embedded subscription that is already isActive:false has no
    // active row to expire; the read must be a no-op, not throw "inconsistent".
    const inactiveEndDate = new Date('2025-12-28T00:00:00Z');
    const { service, subscriptionRepository } = createService({
      userRepository: {
        findSubscriptionById: vi.fn().mockResolvedValue({
          planId: 'premium_6months',
          planName: 'Premium 6 months',
          isActive: false,
          endDate: inactiveEndDate,
          payosOrderId: 'order-1',
        }),
      },
      subscriptionRepository: {
        expireCurrentForUser: vi.fn(),
      },
    });

    await expect(service.getSubscriptionStatus('user-1')).resolves.toEqual({
      subscription: {
        plan: { id: 'premium_6months', name: 'Premium 6 months' },
        isActive: false,
        endDate: inactiveEndDate.toISOString(),
        status: 'expired',
        payosOrderId: 'order-1',
      },
      isPremium: false,
    });
    expect(subscriptionRepository.expireCurrentForUser).not.toHaveBeenCalled();
    // No durable mutation → no entitlement invalidation.
    expect(invalidateEntitlementsMock).not.toHaveBeenCalled();
  });

  it('expires both subscription records and stale embedded user subscriptions in cron checks', async () => {
    const { service, subscriptionRepository } = createService({
      subscriptionRepository: {
        expireDue: vi.fn().mockResolvedValue({
          count: 2,
          userIds: ['user-a', 'user-b'],
        }),
      },
    });

    const updatedCount = await service.checkAndUpdateExpiredSubscriptions();

    expect(updatedCount).toBe(2);
    expect(subscriptionRepository.expireDue).toHaveBeenCalledWith(expect.any(Date));
    expect(invalidateEntitlementsMock).toHaveBeenCalledTimes(2);
    expect(invalidateEntitlementsMock).toHaveBeenCalledWith('user-a');
    expect(invalidateEntitlementsMock).toHaveBeenCalledWith('user-b');
  });

  it('returns the stored snapshot when the PayOS transaction was already activated', async () => {
    const existingSnapshot = subscriptionFixture({
      userId: 'user-1',
      payosOrderId: '123',
      startDate: new Date('2099-01-01T00:00:00Z'),
      endDate: new Date('2099-02-01T00:00:00Z'),
      createdAt: new Date('2099-01-01T00:00:00Z'),
    });

    const { service, subscriptionRepository } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue(
          subscriptionFixture({
            userId: 'user-1',
            payosOrderId: '123',
            status: 'pending',
          }),
        ),
        findByTransactionReference: vi.fn().mockResolvedValue(existingSnapshot),
      },
    });

    const result = await service.activateVerifiedSubscription(123, {
      orderCode: 123,
      amount: 99000,
      reference: 'duplicate-ref',
    });

    expect(result).toEqual({
      success: true,
      subscription: {
        plan: { id: 'premium', name: 'Premium' },
        startDate: existingSnapshot.startDate,
        endDate: existingSnapshot.endDate,
        isActive: true,
      },
    });
    expect(subscriptionRepository.activateSubscription).not.toHaveBeenCalled();
  });

  it('rejects a transaction reference already owned by a different subscription', async () => {
    const pending = subscriptionFixture({
      userId: 'user-1',
      payosOrderId: '123',
      status: 'pending',
    });
    const otherSubscription = subscriptionFixture({
      userId: 'user-2',
      payosOrderId: '999',
      payosTransactionId: 'replayed-ref',
    });
    const { service } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue(pending),
        findByTransactionReference: vi.fn().mockResolvedValue(otherSubscription),
      },
    });

    await expect(
      service.activateVerifiedSubscription(123, {
        orderCode: 123,
        amount: pending.amount,
        reference: 'replayed-ref',
      }),
    ).rejects.toBeInstanceOf(SubscriptionActivationConflictError);
    expect(invalidateEntitlementsMock).not.toHaveBeenCalled();
  });

  it('validates a signed event before returning completed idempotent success', async () => {
    const completed = subscriptionFixture({ payosOrderId: '123' });
    const { service } = createService({
      subscriptionRepository: { findByOrderId: vi.fn().mockResolvedValue(completed) },
    });

    await expect(
      service.activateVerifiedSubscription(123, {
        orderCode: 123,
        amount: completed.amount + 1,
        reference: 'malformed-replay-ref',
      }),
    ).rejects.toThrow('Payment amount mismatch');
    expect(invalidateEntitlementsMock).not.toHaveBeenCalled();
  });

  it('recovers from concurrent activation duplicate-key errors', async () => {
    const settledSnapshot = subscriptionFixture({
      userId: 'user-1',
      payosOrderId: '456',
      startDate: new Date('2099-03-01T00:00:00Z'),
      endDate: new Date('2099-04-01T00:00:00Z'),
      createdAt: new Date('2099-03-01T00:00:00Z'),
    });

    const dupError = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });

    const { service } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue(
          subscriptionFixture({
            userId: 'user-1',
            payosOrderId: '456',
            status: 'pending',
          }),
        ),
        findByTransactionReference: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(settledSnapshot),
        activateSubscription: vi.fn().mockRejectedValue(dupError),
      },
    });

    const result = await service.activateVerifiedSubscription(456, {
      orderCode: 456,
      amount: 99000,
      reference: 'concurrent-ref',
    });

    expect(result.success).toBe(true);
    expect(result.subscription.endDate).toEqual(settledSnapshot.endDate);
  });

  it('recovers when the order was settled by a concurrent activation', async () => {
    const pending = subscriptionFixture({ status: 'pending' });
    delete pending.startDate;
    delete pending.endDate;
    const settled = subscriptionFixture({
      startDate: new Date('2099-05-01T00:00:00Z'),
      endDate: new Date('2099-06-01T00:00:00Z'),
    });
    const { service, subscriptionRepository } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValueOnce(pending).mockResolvedValueOnce(settled),
        activateSubscription: vi
          .fn()
          .mockRejectedValue(
            new SubscriptionActivationConflictError('Pending subscription changed'),
          ),
      },
    });

    await expect(
      service.activateVerifiedSubscription(123, {
        orderCode: 123,
        amount: pending.amount,
        reference: 'concurrent-order-ref',
      }),
    ).resolves.toEqual({
      success: true,
      subscription: {
        plan: { id: settled.planId, name: settled.planName },
        startDate: settled.startDate,
        endDate: settled.endDate,
        isActive: true,
      },
    });
    expect(subscriptionRepository.findByOrderId).toHaveBeenCalledTimes(2);
  });

  it('fails closed when an activation conflict did not settle the order', async () => {
    const pending = subscriptionFixture({ status: 'pending' });
    delete pending.startDate;
    delete pending.endDate;
    const conflict = new SubscriptionActivationConflictError('Subscription user changed');
    const { service } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue(pending),
        activateSubscription: vi.fn().mockRejectedValue(conflict),
      },
    });

    await expect(
      service.activateVerifiedSubscription(123, {
        orderCode: 123,
        amount: pending.amount,
        reference: 'unsettled-ref',
      }),
    ).rejects.toBe(conflict);
    expect(invalidateEntitlementsMock).not.toHaveBeenCalled();
  });

  it('omits a missing optional end date from completed activation DTOs', async () => {
    const completed = subscriptionFixture();
    delete completed.endDate;
    const { service } = createService({
      subscriptionRepository: { findByOrderId: vi.fn().mockResolvedValue(completed) },
    });

    const result = await service.verifyAndActivateSubscription(123, completed.userId);

    expect(result.subscription).not.toHaveProperty('endDate');
  });

  it('rethrows non-duplicate transaction failures during activation', async () => {
    const { service, subscriptionRepository } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          userId: 'user-1',
          planId: 'premium',
          planName: 'Premium',
          amount: 99000,
          status: 'pending',
        }),
        findByTransactionReference: vi.fn().mockResolvedValue(null),
        activateSubscription: vi.fn().mockRejectedValue(new Error('mongo unreachable')),
      },
    });

    await expect(
      service.activateVerifiedSubscription(789, {
        orderCode: 789,
        amount: 99000,
        reference: 'failure-ref',
      }),
    ).rejects.toThrow('mongo unreachable');
    expect(subscriptionRepository.findByOrderId).toHaveBeenCalledOnce();
  });

  it('fails closed when verification or webhook activation cannot find the order', async () => {
    const { service, payosService, subscriptionRepository } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(service.verifyAndActivateSubscription(123, 'user-1')).rejects.toThrow(
      'Subscription not found',
    );
    await expect(
      service.activateVerifiedSubscription(123, {
        orderCode: 123,
        amount: 99000,
        reference: 'missing-order-ref',
      }),
    ).rejects.toThrow('Subscription not found');

    expect(subscriptionRepository.findByOrderId).toHaveBeenCalledTimes(2);
    expect(payosService.verifyPayment).not.toHaveBeenCalled();
  });

  it('uses the stable verification error when PayOS omits its description', async () => {
    const { service } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          userId: 'user-1',
          planId: 'premium',
          planName: 'Premium',
          amount: 99000,
          status: 'pending',
        }),
      },
      payosService: {
        verifyPayment: vi.fn().mockResolvedValue({ code: '99', desc: '' }),
      },
    });

    await expect(service.verifyAndActivateSubscription(123, 'user-1')).rejects.toThrow(
      'Failed to verify payment',
    );
  });

  it('treats the exact completed-subscription expiry instant as expired', async () => {
    const expiry = new Date('2026-08-01T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(expiry);

    try {
      const { service } = createService({
        subscriptionRepository: {
          findByOrderId: vi.fn().mockResolvedValue({
            userId: 'user-1',
            planId: 'premium',
            planName: 'Premium',
            status: 'completed',
            startDate: new Date('2026-07-01T00:00:00.000Z'),
            endDate: expiry,
            isActive: true,
          }),
        },
      });

      await expect(service.verifyAndActivateSubscription(123, 'user-1')).rejects.toThrow(
        'Subscription already expired',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('activates verification with the latest PayOS transaction reference', async () => {
    const transaction = payosPaymentLinkData().transactions[0];
    if (!transaction) throw new Error('PayOS transaction fixture is missing');
    const { service, subscriptionRepository } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          userId: 'user-1',
          planId: 'premium',
          planName: 'Premium',
          amount: 99000,
          status: 'pending',
        }),
      },
      payosService: {
        verifyPayment: vi.fn().mockResolvedValue({
          code: '00',
          desc: 'success',
          data: payosPaymentLinkData({
            transactions: [
              { ...transaction, reference: 'older-reference' },
              { ...transaction, reference: 'latest-reference' },
            ],
          }),
        }),
      },
    });

    await expect(service.verifyAndActivateSubscription(123, 'user-1')).resolves.toMatchObject({
      success: true,
      subscription: { plan: { id: 'premium', name: 'Premium' }, isActive: true },
    });
    expect(subscriptionRepository.findByTransactionReference).toHaveBeenCalledWith(
      'latest-reference',
    );
    expect(subscriptionRepository.activateSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ transactionReference: 'latest-reference' }),
    );
  });

  it('reports a missing checkout URL without leaking a TypeError when data is absent', async () => {
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
        createPayment: vi.fn().mockResolvedValue({ code: '00', desc: 'success', data: undefined }),
      },
    });

    await expect(service.createPaymentRequest('user-1', 'premium')).rejects.toThrow(
      'Payment URL not received from PayOS',
    );
    expect(subscriptionRepository.create).toHaveBeenCalledOnce();
    expect(subscriptionRepository.settlePendingPayment).not.toHaveBeenCalled();
  });

  it('preserves the original payment transport error and pending record', async () => {
    const paymentError = new Error('PayOS transport failed');
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
        createPayment: vi.fn().mockRejectedValue(paymentError),
      },
    });

    await expect(service.createPaymentRequest('user-1', 'premium')).rejects.toBe(paymentError);
    expect(subscriptionRepository.create).toHaveBeenCalledOnce();
    expect(subscriptionRepository.settlePendingPayment).not.toHaveBeenCalled();
  });

  it('allows an expired embedded premium subscription but rejects a future active one', async () => {
    const successfulPayment = {
      code: '00',
      desc: 'success',
      data: {
        checkoutUrl: 'https://pay.payos.vn/web/checkout',
        qrCode: 'qr-code',
      },
    };
    const expired = createService({
      userRepository: {
        findById: vi.fn().mockResolvedValue({
          email: 'user@example.com',
          subscription: {
            planId: 'premium',
            planName: 'Premium',
            isActive: true,
            endDate: new Date('2000-01-01T00:00:00.000Z'),
          },
        }),
      },
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue(null),
      },
      payosService: {
        createPayment: vi.fn().mockResolvedValue(successfulPayment),
      },
    });
    const active = createService({
      userRepository: {
        findById: vi.fn().mockResolvedValue({
          email: 'user@example.com',
          subscription: {
            planId: 'premium',
            planName: 'Premium',
            isActive: true,
            endDate: new Date('2099-01-01T00:00:00.000Z'),
          },
        }),
      },
    });

    await expect(expired.service.createPaymentRequest('user-1', 'premium')).resolves.toMatchObject({
      paymentUrl: 'https://pay.payos.vn/web/checkout',
    });
    await expect(active.service.createPaymentRequest('user-1', 'premium')).rejects.toThrow(
      'User already has an active subscription',
    );
    expect(expired.subscriptionRepository.create).toHaveBeenCalledOnce();
    expect(active.subscriptionRepository.create).not.toHaveBeenCalled();
  });

  it('uses the collision-resistant order-code formula in the persisted payment request', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const randomSpy = vi.spyOn(crypto, 'randomInt');

    try {
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
            code: '00',
            desc: 'success',
            data: { checkoutUrl: 'https://pay.payos.vn/web/checkout' },
          }),
        },
      });

      const result = await service.createPaymentRequest('user-1', 'premium');
      const randomSuffix = randomSpy.mock.results[0]?.value;
      if (typeof randomSuffix !== 'number') {
        throw new TypeError('crypto.randomInt did not return a numeric order-code suffix');
      }
      const expectedOrderCode = 1_700_000_000_000 * 1000 + randomSuffix;

      expect(result).toMatchObject({ orderCode: expectedOrderCode });
      expect(randomSpy).toHaveBeenCalledWith(0, 1000);
      expect(subscriptionRepository.findByOrderId).toHaveBeenCalledWith(
        expectedOrderCode.toString(),
      );
      expect(subscriptionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ payosOrderId: expectedOrderCode.toString() }),
      );
    } finally {
      nowSpy.mockRestore();
      randomSpy.mockRestore();
    }
  });

  it('returns stable admin errors for thrown Error and non-Error failures', async () => {
    const { service } = createService({
      subscriptionRepository: {
        updateAdminStatusById: vi
          .fn()
          .mockRejectedValueOnce(new Error('database unavailable'))
          .mockRejectedValueOnce('connection aborted'),
      },
    });

    await expect(service.updateSubscriptionById('sub-1', { status: 'cancelled' })).resolves.toEqual(
      {
        success: false,
        error: 'database unavailable',
        statusCode: 500,
      },
    );
    await expect(service.updateSubscriptionById('sub-1', { status: 'cancelled' })).resolves.toEqual(
      {
        success: false,
        error: 'Failed to update subscription',
        statusCode: 500,
      },
    );
    expect(invalidateEntitlementsMock).not.toHaveBeenCalled();
  });

  it('fails closed when an expired embedded subscription cannot be persisted consistently', async () => {
    const missingOrder = createService({
      userRepository: {
        findSubscriptionById: vi.fn().mockResolvedValue({
          planId: 'premium',
          planName: 'Premium',
          isActive: true,
          endDate: new Date('2000-01-01T00:00:00.000Z'),
        }),
      },
    });
    const missingRecord = createService({
      userRepository: {
        findSubscriptionById: vi.fn().mockResolvedValue({
          planId: 'premium',
          planName: 'Premium',
          isActive: true,
          endDate: new Date('2000-01-01T00:00:00.000Z'),
          payosOrderId: 'order-1',
        }),
      },
      subscriptionRepository: {
        expireCurrentForUser: vi.fn().mockResolvedValue(false),
      },
    });

    await expect(missingOrder.service.getSubscriptionStatus('user-1')).rejects.toThrow(
      'Expired subscription is missing payosOrderId',
    );
    await expect(missingRecord.service.getSubscriptionStatus('user-1')).rejects.toThrow(
      'Current subscription record is inconsistent',
    );
    expect(missingOrder.subscriptionRepository.expireCurrentForUser).not.toHaveBeenCalled();
    expect(missingRecord.subscriptionRepository.expireCurrentForUser).toHaveBeenCalledWith(
      'user-1',
      'order-1',
    );
    // false/missing payosOrderId must not clear entitlement cache
    expect(invalidateEntitlementsMock).not.toHaveBeenCalled();
  });
});

describe('SubscriptionService payment cancellation reconciliation', () => {
  const pending = subscriptionFixture({ status: 'pending', isActive: false });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('settles an authenticated pending order only after PayOS confirms cancellation', async () => {
    const cancelled = subscriptionFixture({ status: 'cancelled', isActive: false });
    const { service, subscriptionRepository } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue(pending),
        settlePendingPayment: vi.fn().mockResolvedValue(cancelled),
      },
      payosService: {
        getPaymentInfo: vi.fn().mockResolvedValue({
          code: '00',
          desc: 'success',
          data: payosPaymentLinkData({
            status: 'CANCELLED',
            amountPaid: 0,
            amountRemaining: 99000,
            transactions: [],
            canceledAt: '2026-07-02T04:10:00.000Z',
          }),
        }),
      },
    });

    await expect(service.reconcilePaymentCancellation(123, 'user-1')).resolves.toEqual({
      success: true,
      data: { status: 'cancelled' },
    });
    expect(subscriptionRepository.settlePendingPayment).toHaveBeenCalledWith(
      '123',
      'user-1',
      'cancelled',
    );
  });

  it('does not query PayOS for an order owned by another user', async () => {
    const { service, payosService } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue(pending),
      },
    });

    await expect(service.reconcilePaymentCancellation(123, 'other-user')).resolves.toMatchObject({
      success: false,
      statusCode: 403,
      code: 'forbidden',
    });
    expect(payosService.getPaymentInfo).not.toHaveBeenCalled();
  });

  it('routes an authoritative paid order to the success verifier without cancelling it', async () => {
    const { service, subscriptionRepository } = createService({
      subscriptionRepository: { findByOrderId: vi.fn().mockResolvedValue(pending) },
      payosService: {
        getPaymentInfo: vi.fn().mockResolvedValue({
          code: '00',
          desc: 'success',
          data: payosPaymentLinkData(),
        }),
      },
    });

    await expect(service.reconcilePaymentCancellation(123, 'user-1')).resolves.toEqual({
      success: true,
      data: { status: 'paid' },
    });
    expect(subscriptionRepository.settlePendingPayment).not.toHaveBeenCalled();
  });

  it('fails closed when PayOS returns a different order or amount', async () => {
    const { service, subscriptionRepository } = createService({
      subscriptionRepository: { findByOrderId: vi.fn().mockResolvedValue(pending) },
      payosService: {
        getPaymentInfo: vi.fn().mockResolvedValue({
          code: '00',
          desc: 'success',
          data: payosPaymentLinkData({ orderCode: 999 }),
        }),
      },
    });

    await expect(service.reconcilePaymentCancellation(123, 'user-1')).resolves.toMatchObject({
      success: false,
      statusCode: 502,
      code: 'payment_provider_error',
    });
    expect(subscriptionRepository.settlePendingPayment).not.toHaveBeenCalled();
  });

  it('returns the durable winner when cancellation races another writer', async () => {
    const completed = subscriptionFixture();
    const { service } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValueOnce(pending).mockResolvedValueOnce(completed),
        settlePendingPayment: vi.fn().mockResolvedValue(null),
      },
      payosService: {
        getPaymentInfo: vi.fn().mockResolvedValue({
          code: '00',
          desc: 'success',
          data: payosPaymentLinkData({
            status: 'CANCELLED',
            amountPaid: 0,
            amountRemaining: 99000,
            transactions: [],
          }),
        }),
      },
    });

    await expect(service.reconcilePaymentCancellation(123, 'user-1')).resolves.toEqual({
      success: true,
      data: { status: 'paid' },
    });
  });
});

describe('SubscriptionService entitlement cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateEntitlementsMock.mockReset();
  });

  it('invalidates the exact user after successful verify activation', async () => {
    const { service } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          userId: 'user-verify',
          planId: 'premium',
          planName: 'Premium',
          amount: 99000,
          status: 'pending',
        }),
      },
      payosService: {
        verifyPayment: vi.fn().mockResolvedValue({
          code: '00',
          desc: 'success',
          data: payosPaymentLinkData({ orderCode: 123, amount: 99000 }),
        }),
      },
    });

    await expect(service.verifyAndActivateSubscription(123, 'user-verify')).resolves.toMatchObject({
      success: true,
    });
    expect(invalidateEntitlementsMock).toHaveBeenCalledExactlyOnceWith('user-verify');
  });

  it('invalidates the exact user after successful webhook activation', async () => {
    const { service } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          userId: 'user-webhook',
          planId: 'premium',
          planName: 'Premium',
          amount: 99000,
          status: 'pending',
        }),
      },
    });

    await expect(
      service.activateVerifiedSubscription(456, {
        orderCode: 456,
        amount: 99000,
        reference: 'webhook-ref',
      }),
    ).resolves.toMatchObject({ success: true });
    expect(invalidateEntitlementsMock).toHaveBeenCalledExactlyOnceWith('user-webhook');
  });

  it('invalidates after concurrent conflict recovery that settled completed', async () => {
    const pending = subscriptionFixture({ userId: 'user-race', status: 'pending' });
    delete pending.startDate;
    delete pending.endDate;
    const settled = subscriptionFixture({
      userId: 'user-race',
      startDate: new Date('2099-05-01T00:00:00Z'),
      endDate: new Date('2099-06-01T00:00:00Z'),
    });
    const { service } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValueOnce(pending).mockResolvedValueOnce(settled),
        activateSubscription: vi
          .fn()
          .mockRejectedValue(
            new SubscriptionActivationConflictError('Pending subscription changed'),
          ),
      },
    });

    await expect(
      service.activateVerifiedSubscription(123, {
        orderCode: 123,
        amount: pending.amount,
        reference: 'race-ref',
      }),
    ).resolves.toMatchObject({ success: true });
    expect(invalidateEntitlementsMock).toHaveBeenCalledExactlyOnceWith('user-race');
  });

  it('invalidates after duplicate-key recovery that settled completed', async () => {
    const settledSnapshot = subscriptionFixture({
      userId: 'user-dup',
      payosOrderId: '456',
      startDate: new Date('2099-03-01T00:00:00Z'),
      endDate: new Date('2099-04-01T00:00:00Z'),
    });
    const dupError = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    const { service } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue(
          subscriptionFixture({
            userId: 'user-dup',
            payosOrderId: '456',
            status: 'pending',
          }),
        ),
        findByTransactionReference: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(settledSnapshot),
        activateSubscription: vi.fn().mockRejectedValue(dupError),
      },
    });

    await expect(
      service.activateVerifiedSubscription(456, {
        orderCode: 456,
        amount: 99000,
        reference: 'dup-ref',
      }),
    ).resolves.toMatchObject({ success: true });
    expect(invalidateEntitlementsMock).toHaveBeenCalledExactlyOnceWith('user-dup');
  });

  it('does not invalidate when activation throws before commit', async () => {
    const { service } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue({
          userId: 'user-fail',
          planId: 'premium',
          planName: 'Premium',
          amount: 99000,
          status: 'pending',
        }),
        activateSubscription: vi.fn().mockRejectedValue(new Error('mongo unreachable')),
      },
    });

    await expect(
      service.activateVerifiedSubscription(789, {
        orderCode: 789,
        amount: 99000,
        reference: 'fail-ref',
      }),
    ).rejects.toThrow('mongo unreachable');
    expect(invalidateEntitlementsMock).not.toHaveBeenCalled();
  });

  it('does not invalidate when an activation conflict remains unsettled', async () => {
    const pending = subscriptionFixture({ status: 'pending' });
    delete pending.startDate;
    delete pending.endDate;
    const conflict = new SubscriptionActivationConflictError('Subscription user changed');
    const { service } = createService({
      subscriptionRepository: {
        findByOrderId: vi.fn().mockResolvedValue(pending),
        activateSubscription: vi.fn().mockRejectedValue(conflict),
      },
    });

    await expect(
      service.activateVerifiedSubscription(123, {
        orderCode: 123,
        amount: pending.amount,
        reference: 'unsettled-cache-ref',
      }),
    ).rejects.toBe(conflict);
    expect(invalidateEntitlementsMock).not.toHaveBeenCalled();
  });

  it('invalidates exact user after confirmed lazy expiry mutation', async () => {
    const { service, subscriptionRepository } = createService({
      userRepository: {
        findSubscriptionById: vi.fn().mockResolvedValue({
          planId: 'premium',
          planName: 'Premium',
          isActive: true,
          endDate: new Date('2000-01-01T00:00:00.000Z'),
          payosOrderId: 'order-lazy',
        }),
      },
      subscriptionRepository: {
        expireCurrentForUser: vi.fn().mockResolvedValue(true),
      },
    });

    await expect(service.isUserPremium('user-lazy')).resolves.toBe(false);
    expect(subscriptionRepository.expireCurrentForUser).toHaveBeenCalledWith(
      'user-lazy',
      'order-lazy',
    );
    expect(invalidateEntitlementsMock).toHaveBeenCalledExactlyOnceWith('user-lazy');
  });

  it('does not invalidate when lazy expiry returns false', async () => {
    const { service } = createService({
      userRepository: {
        findSubscriptionById: vi.fn().mockResolvedValue({
          planId: 'premium',
          planName: 'Premium',
          isActive: true,
          endDate: new Date('2000-01-01T00:00:00.000Z'),
          payosOrderId: 'order-false',
        }),
      },
      subscriptionRepository: {
        expireCurrentForUser: vi.fn().mockResolvedValue(false),
      },
    });

    await expect(service.getSubscriptionStatus('user-false')).rejects.toThrow(
      'Current subscription record is inconsistent',
    );
    expect(invalidateEntitlementsMock).not.toHaveBeenCalled();
  });

  it('does not invalidate when lazy expiry throws', async () => {
    const { service } = createService({
      userRepository: {
        findSubscriptionById: vi.fn().mockResolvedValue({
          planId: 'premium',
          planName: 'Premium',
          isActive: true,
          endDate: new Date('2000-01-01T00:00:00.000Z'),
          payosOrderId: 'order-throw',
        }),
      },
      subscriptionRepository: {
        expireCurrentForUser: vi.fn().mockRejectedValue(new Error('txn aborted')),
      },
    });

    await expect(service.getSubscriptionStatus('user-throw')).rejects.toThrow('txn aborted');
    expect(invalidateEntitlementsMock).not.toHaveBeenCalled();
  });

  it('batch success invalidates each unique user and still returns count', async () => {
    const { service, subscriptionRepository } = createService({
      subscriptionRepository: {
        expireDue: vi.fn().mockResolvedValue({
          count: 3,
          // repository already dedupes; include a duplicate to prove service loops the list as-is
          userIds: ['u1', 'u2', 'u3'],
        }),
      },
    });

    await expect(service.checkAndUpdateExpiredSubscriptions()).resolves.toBe(3);
    expect(subscriptionRepository.expireDue).toHaveBeenCalledWith(expect.any(Date));
    expect(invalidateEntitlementsMock).toHaveBeenCalledTimes(3);
    expect(invalidateEntitlementsMock).toHaveBeenNthCalledWith(1, 'u1');
    expect(invalidateEntitlementsMock).toHaveBeenNthCalledWith(2, 'u2');
    expect(invalidateEntitlementsMock).toHaveBeenNthCalledWith(3, 'u3');
  });

  it('batch zero candidates does not invalidate', async () => {
    const { service } = createService({
      subscriptionRepository: {
        expireDue: vi.fn().mockResolvedValue({ count: 0, userIds: [] }),
      },
    });

    await expect(service.checkAndUpdateExpiredSubscriptions()).resolves.toBe(0);
    expect(invalidateEntitlementsMock).not.toHaveBeenCalled();
  });

  it('batch failure does not invalidate', async () => {
    const { service } = createService({
      subscriptionRepository: {
        expireDue: vi.fn().mockRejectedValue(new Error('batch expire failed')),
      },
    });

    await expect(service.checkAndUpdateExpiredSubscriptions()).rejects.toThrow(
      'batch expire failed',
    );
    expect(invalidateEntitlementsMock).not.toHaveBeenCalled();
  });
});
