/**
 * Run async tasks with a fixed concurrency limit.
 * Preserves output order by index.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (concurrency <= 0) {
    throw new Error('concurrency must be greater than 0');
  }

  const results = new Array<R>(items.length);
  let cursor = 0;

  const runWorker = async (): Promise<void> => {
    const index = cursor;
    cursor += 1;

    if (index >= items.length) {
      return;
    }

    results[index] = await mapper(items[index], index);
    await runWorker();
  };

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());

  await Promise.all(workers);
  return results;
}
