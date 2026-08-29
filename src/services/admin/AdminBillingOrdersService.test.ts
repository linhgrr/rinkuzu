import { describe, expect, it, vi } from 'vitest';
import type {
  AdminBillingHealthSnapshot,
  AdminBillingOrderDetailRecord,
  AdminBillingOrderRecord,
  AdminBillingWebhookDiagnosticRecord,
} from '@/entities/AdminBillingOrders';
import type { PaginationMeta } from '@/dtos/common';
import type {
  AdminBillingOrderListOptions,
  AdminWebhookDiagnosticListOptions,
  IAdminBillingOrdersRepository,
} from '@/interfaces/repositories/IAdminBillingOrdersRepository';
import type { PaginatedRepositoryResult } from '@/interfaces/repositories/types';
import { AdminBillingOrdersService } from './AdminBillingOrdersService';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const PAGINATION: PaginationMeta = {
  currentPage: 1,
  totalPages: 1,
  totalItems: 1,
  itemsPerPage: 20,
  hasNextPage: false,
  hasPrevPage: false,
};

const HEALTH: AdminBillingHealthSnapshot = {
  ordersNeedingAttention: 2,
  paidButUnfulfilled: 1,
  attemptsInReview: 0,
  attemptsIndeterminate: 0,
  inboxOrphaned: 0,
  inboxRetryable: 0,
  inboxDeadLettered: 0,
  webhooksUnsupportedSchema: 0,
  webhooksUnauthenticatedRecent: 0,
};

const ORDER: AdminBillingOrderRecord = {
  publicId: 'order-public-1',
  orderCode: 424242,
  userId: 'user-1',
  planId: 'plan-1',
  planName: 'Premium Monthly',
  currency: 'VND',
  finalAmount: 49_000,
  receivedAmount: 49_000,
  excessAmount: 0,
  excessResolution: 'none',
  collectionStatus: 'paid',
  fulfillmentStatus: 'fulfilled',
  settlementStatus: 'settled',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-02T00:00:00.000Z'),
};

const WEBHOOK: AdminBillingWebhookDiagnosticRecord = {
  id: 'inbox-1',
  provider: 'payos',
  environment: 'production',
  verificationClass: 'unsupported_schema',
  status: 'dead_letter',
  rawPayloadHash: 'a'.repeat(64),
  retainedPayloadStored: true,
  attemptCount: 3,
  createdAt: new Date('2026-08-03T00:00:00.000Z'),
};

const DETAIL: AdminBillingOrderDetailRecord = {
  order: ORDER,
  attempts: [],
  transactions: [],
  adjustments: [],
  entitlement: { granted: true, revoked: false, perpetual: false },
};

interface RepositoryDouble {
  repository: IAdminBillingOrdersRepository;
  orderOptions: AdminBillingOrderListOptions[];
  webhookOptions: AdminWebhookDiagnosticListOptions[];
}

/**
 * A repository that records what the service asked it for.
 *
 * The options object is as much the thing under test as the return value. The
 * service builds it conditionally, and an optional filter that silently arrives
 * as `undefined` is how an operator asking for only the unauthenticated
 * deliveries quietly gets all of them.
 */
function repositoryDouble(
  overrides: Partial<IAdminBillingOrdersRepository> = {},
): RepositoryDouble {
  const orderOptions: AdminBillingOrderListOptions[] = [];
  const webhookOptions: AdminWebhookDiagnosticListOptions[] = [];
  const repository: IAdminBillingOrdersRepository = {
    listOrders: async (options): Promise<PaginatedRepositoryResult<AdminBillingOrderRecord>> => {
      orderOptions.push(options);
      return { items: [ORDER], pagination: PAGINATION };
    },
    health: async () => HEALTH,
    findOrderDetail: async () => DETAIL,
    listWebhookDiagnostics: async (
      options,
    ): Promise<PaginatedRepositoryResult<AdminBillingWebhookDiagnosticRecord>> => {
      webhookOptions.push(options);
      return { items: [WEBHOOK], pagination: PAGINATION };
    },
    ...overrides,
  };
  return { repository, orderOptions, webhookOptions };
}

describe('listing the operator order queue', () => {
  it('ships the health counters with every page', async () => {
    // The counters are the reason the page exists; a list without them cannot
    // answer "is anything stuck?", which is the only question it is opened for.
    const { repository } = repositoryDouble();

    const result = await new AdminBillingOrdersService(repository).listOrders({
      page: 1,
      limit: 20,
      bucket: 'all',
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('expected a successful list');
    expect(result.data.orders).toHaveLength(1);
    expect(result.data.health.paidButUnfulfilled).toBe(1);
  });

  it('omits the search filter entirely when none was given', async () => {
    const { repository, orderOptions } = repositoryDouble();

    await new AdminBillingOrdersService(repository).listOrders({
      page: 2,
      limit: 10,
      bucket: 'attention',
    });

    expect(orderOptions[0]).toEqual({ page: 2, limit: 10, bucket: 'attention' });
    expect(orderOptions[0]).not.toHaveProperty('search');
  });

  it('passes a search term through when one was given', async () => {
    const { repository, orderOptions } = repositoryDouble();

    await new AdminBillingOrdersService(repository).listOrders({
      page: 1,
      limit: 20,
      bucket: 'all',
      search: '424242',
    });

    expect(orderOptions[0]?.search).toBe('424242');
  });

  it('reports a repository failure as a 500 rather than throwing', async () => {
    const { repository } = repositoryDouble({
      listOrders: async () => {
        throw new Error('mongo is down');
      },
    });

    const result = await new AdminBillingOrdersService(repository).listOrders({
      page: 1,
      limit: 20,
      bucket: 'all',
    });

    expect(result).toEqual({ success: false, error: 'Internal server error', statusCode: 500 });
  });
});

describe('listing the webhook diagnostics', () => {
  it('maps a retained-body row without ever exposing the body', async () => {
    // Retention exists so a parser bug can be explained, and the list is the
    // wrong place to hand out the sealed payload: the row says one exists and
    // which key sealed it, and nothing more.
    const { repository } = repositoryDouble();

    const result = await new AdminBillingOrdersService(repository).listWebhookDiagnostics({
      page: 1,
      limit: 20,
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('expected a successful list');
    const [row] = result.data.webhooks;
    expect(row?.id).toBe('inbox-1');
    expect(row?.retainedPayloadStored).toBe(true);
    expect(row).not.toHaveProperty('encryptedRawPayload');
    expect(row).not.toHaveProperty('rawPayload');
  });

  it('omits the verification class filter entirely when none was given', async () => {
    const { repository, webhookOptions } = repositoryDouble();

    await new AdminBillingOrdersService(repository).listWebhookDiagnostics({ page: 1, limit: 20 });

    expect(webhookOptions[0]).toEqual({ page: 1, limit: 20 });
    expect(webhookOptions[0]).not.toHaveProperty('verificationClass');
  });

  it('passes the verification class through when one was given', async () => {
    const { repository, webhookOptions } = repositoryDouble();

    await new AdminBillingOrdersService(repository).listWebhookDiagnostics({
      page: 1,
      limit: 20,
      verificationClass: 'unauthenticated',
    });

    expect(webhookOptions[0]?.verificationClass).toBe('unauthenticated');
  });

  it('reports a repository failure as a 500 rather than throwing', async () => {
    const { repository } = repositoryDouble({
      listWebhookDiagnostics: async () => {
        throw new Error('mongo is down');
      },
    });

    const result = await new AdminBillingOrdersService(repository).listWebhookDiagnostics({
      page: 1,
      limit: 20,
    });

    expect(result).toEqual({ success: false, error: 'Internal server error', statusCode: 500 });
  });
});

describe('reading one order in detail', () => {
  it('returns the order with its entitlement snapshot', async () => {
    const { repository } = repositoryDouble();

    const result = await new AdminBillingOrdersService(repository).getOrderDetail('order-public-1');

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('expected a successful detail read');
    expect(result.data.order.id).toBe('order-public-1');
    expect(result.data.entitlement.granted).toBe(true);
  });

  it('is a 404 for an order that does not exist, not a 500', async () => {
    const { repository } = repositoryDouble({ findOrderDetail: async () => null });

    const result = await new AdminBillingOrdersService(repository).getOrderDetail('missing');

    expect(result).toEqual({ success: false, error: 'Order not found', statusCode: 404 });
  });

  it('reports a repository failure as a 500 rather than throwing', async () => {
    const { repository } = repositoryDouble({
      findOrderDetail: async () => {
        throw new Error('mongo is down');
      },
    });

    const result = await new AdminBillingOrdersService(repository).getOrderDetail('order-public-1');

    expect(result).toEqual({ success: false, error: 'Internal server error', statusCode: 500 });
  });
});
