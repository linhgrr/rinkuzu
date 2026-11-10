/**
 * Tells search engines that public URLs changed (RIN-1500). Fire-and-forget:
 * it returns at once, never throws, and the work runs after the response.
 */
export interface IIndexNowNotifier {
  notifyChanged(urls: readonly string[]): void;
}
