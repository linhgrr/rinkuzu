/**
 * Lower progress bound of steps 2-6 (the API's PipelineProgress checkpoints). A failed job keeps
 * its progress but reports status `failed`, so this is how a reloaded page finds the failed step.
 */
const STEP_PROGRESS_STARTS = [0.15, 0.35, 0.5, 0.7, 0.9] as const;

export function stepFromProgress(progress: number): number | null {
  if (!(progress > 0)) return null;
  return 1 + STEP_PROGRESS_STARTS.filter((start) => progress >= start).length;
}
