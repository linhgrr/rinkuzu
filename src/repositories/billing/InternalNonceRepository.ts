import connectDB from '@/lib/mongoose';
import { InternalRequestNonce } from '@/models/Billing';
import type { IInternalNonceRepository } from '@/interfaces/repositories/IInternalNonceRepository';
import { BillingDomainError } from '@/services/billing/billing-domain';

/**
 * Single-use tokens for the internal scheduler routes.
 *
 * The unique index is the whole mechanism: a second request carrying a nonce we
 * have already stored collides on insert, and a collision is the proof of a
 * replay. Checking first and inserting second would leave a window two
 * concurrent replays could both pass through.
 */
export class InternalNonceRepository implements IInternalNonceRepository {
  async consumeInternalNonce(nonce: string, expiresAt: Date): Promise<void> {
    await connectDB();
    try {
      await InternalRequestNonce.create({ nonce, expiresAt });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new BillingDomainError('unauthorized', 'Internal request was replayed', 401);
      }
      throw error;
    }
  }
}
