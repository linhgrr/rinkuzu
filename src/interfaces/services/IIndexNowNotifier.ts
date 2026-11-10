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
 * `made-public`: a Premium reject or a failed submission set the quiz public
 * inside a repository transaction, so the caller knows only its id; the
 * notifier reads the slug and checks every gate.
 */
export type QuizIndexNowChange =
  | { quizId: string; slug: string; cause: 'indexability' | 'index-hold' }
  | { quizId: string; cause: 'made-public' };

/**
 * Queues a quiz page and its topic hub for IndexNow (RIN-1500). Fire-and-forget
 * like `IIndexNowNotifier`: the lookup and the enqueue run after the response.
 */
export interface IQuizIndexNowNotifier {
  quizChanged(change: QuizIndexNowChange): void;
}
