/**
 * Single-use nonces for internally signed requests. Its own port because the
 * scheduler routes need nothing else from billing persistence, and a route that
 * only replays-checks should not be handed an order writer to do it.
 */
export interface IInternalNonceRepository {
  /**
   * Records the nonce, or throws `unauthorized` when it has been seen before.
   * The row expires at `expiresAt`, which must match the signature window.
   */
  consumeInternalNonce(nonce: string, expiresAt: Date): Promise<void>;
}
