/**
 * Tells search engines that public URLs changed (RIN-1500). Fire-and-forget:
 * it returns at once, never throws, and the work runs after the response.
 */
export interface IIndexNowNotifier {
  notifyChanged(urls: readonly string[]): void;
}

/**
 * Why a quiz page changed for search (RIN-1500). `indexability`: the caller
 * compared the quiz before and after (`quizSearchChanged`). `index-hold`: only
 * the report hold changed, so the notifier also checks the other gates.
 */
export interface QuizIndexNowChange {
  quizId: string;
  slug: string;
  cause: 'indexability' | 'index-hold';
}

/**
 * Queues a quiz page and its topic hub for IndexNow (RIN-1500). Fire-and-forget
 * like `IIndexNowNotifier`: the lookup and the enqueue run after the response.
 */
export interface IQuizIndexNowNotifier {
  quizChanged(change: QuizIndexNowChange): void;
}
