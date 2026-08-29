import type { IBillingOrderRepository } from '@/interfaces/repositories/IBillingOrderRepository';
import type { IBillingPromotionRepository } from '@/interfaces/repositories/IBillingPromotionRepository';
import type { IInternalNonceRepository } from '@/interfaces/repositories/IInternalNonceRepository';
import type { IWebhookInboxRepository } from '@/interfaces/repositories/IWebhookInboxRepository';
import { BillingAdjustmentRepository } from '@/repositories/billing/BillingAdjustmentRepository';
import { BillingOrderRepository } from '@/repositories/billing/BillingOrderRepository';
import { BillingPromotionRepository } from '@/repositories/billing/BillingPromotionRepository';
import { BillingSettlementRepository } from '@/repositories/billing/BillingSettlementRepository';
import { InternalNonceRepository } from '@/repositories/billing/InternalNonceRepository';
import { WebhookInboxRepository } from '@/repositories/billing/WebhookInboxRepository';
import { BillingService } from '@/services/billing/BillingService';
import { AdminAuditRepository } from '@/repositories/AdminAuditRepository';
import { AdminBillingOrdersRepository } from '@/repositories/AdminBillingOrdersRepository';
import { BillingAlertRepository } from '@/repositories/billing/BillingAlertRepository';
import type { AdjustmentDeps } from '@/services/billing/adjustments/record-adjustment';
import type { AlertingDeps } from '@/services/billing/alerting/raise-alerts';
import { OpsEmailAlertChannel } from '@/services/billing/alerting/ops-email-channel';
import type { WebhookOperationDeps } from '@/services/billing/webhooks/webhook-operations';
import { billingConfig } from '@/services/billing/billing-config';
import { BillingPayOSAdapter } from '@/services/billing/payos-adapter';

/**
 * Where billing's adapters are chosen.
 *
 * Routes may not import a repository, so each narrow port gets its own factory
 * here and a route depends on exactly the one it uses. A checkout endpoint that
 * can reach promotions or record a refund is not a smaller blast radius than
 * the god object it replaced.
 */

export function createBillingOrderRepository(): IBillingOrderRepository {
  return new BillingOrderRepository();
}

export function createBillingPromotionRepository(): IBillingPromotionRepository {
  return new BillingPromotionRepository();
}

/**
 * The adjustment handler's dependencies. Persistence, a clock and the one
 * policy switch it consults are injected together so the handler can be driven
 * end to end without a database or a stubbed environment.
 */
export function createAdjustmentDeps(): AdjustmentDeps {
  return {
    adjustments: new BillingAdjustmentRepository(),
    clock: () => Date.now(),
    autoRevocationEnabled: () => billingConfig.externalRefundAutoRevocationEnabled(),
  };
}

export function createWebhookInboxRepository(): IWebhookInboxRepository {
  return new WebhookInboxRepository();
}

/**
 * The operator-driven webhook actions. The audit port is injected alongside
 * persistence rather than reached for inside it, because an action that can
 * record itself but not be observed doing so is not audited.
 */
export function createWebhookOperationDeps(): WebhookOperationDeps {
  return {
    inbox: new WebhookInboxRepository(),
    audit: new AdminAuditRepository(),
    clock: () => Date.now(),
    payloadKeys: () => billingConfig.webhookPayloadKeys(),
  };
}

export function createInternalNonceRepository(): IInternalNonceRepository {
  return new InternalNonceRepository();
}

/**
 * The alert sweep's dependencies. The health counters come from the same
 * repository the operator page reads, so an alert and the page it points at can
 * never disagree about whether a queue is empty.
 */
export function createAlertingDeps(): AlertingDeps {
  const health = new AdminBillingOrdersRepository();
  return {
    alerts: new BillingAlertRepository(),
    channel: new OpsEmailAlertChannel(),
    clock: () => Date.now(),
    health: () => health.health(),
  };
}

export function createBillingService(): BillingService {
  return new BillingService(
    new BillingOrderRepository(),
    new BillingSettlementRepository(),
    new BillingPromotionRepository(),
    new BillingPayOSAdapter(),
  );
}
