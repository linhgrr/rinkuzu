export interface IDeferredTaskScheduler {
  schedule(task: () => Promise<void>): void;
}
