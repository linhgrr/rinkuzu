import { QUICK_ROUND_SIZE } from '@/shared/constants/quick-round';

const SEEN_STORAGE_PREFIX = 'rinkuzu_quick_seen_v1:';

function shuffled(values: number[], random: () => number): number[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = result[index] as number;
    result[index] = result[swapIndex] as number;
    result[swapIndex] = current;
  }
  return result;
}

/**
 * Quick round draw (RIN-933): `QUICK_ROUND_SIZE` unique quiz question indices, questions
 * not yet seen first, then a random fill from the seen ones.
 */
export function drawQuickRound(
  questionCount: number,
  seen: readonly number[],
  random: () => number = Math.random,
): number[] {
  const seenSet = new Set(seen);
  const all = Array.from({ length: questionCount }, (_, index) => index);
  const unseen = shuffled(
    all.filter((index) => !seenSet.has(index)),
    random,
  );
  const alreadySeen = shuffled(
    all.filter((index) => seenSet.has(index)),
    random,
  );
  return [...unseen, ...alreadySeen].slice(0, QUICK_ROUND_SIZE);
}

function seenStorageKey(slug: string): string {
  return `${SEEN_STORAGE_PREFIX}${slug}`;
}

/** Indices this tab has already played in quick rounds of `slug` (indices only, nothing personal). */
export function readQuickRoundSeen(slug: string): number[] {
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(seenStorageKey(slug)) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((value): value is number => Number.isInteger(value) && value >= 0)
      : [];
  } catch {
    return [];
  }
}

export function markQuickRoundSeen(slug: string, indices: readonly number[]): void {
  try {
    const merged = [...new Set([...readQuickRoundSeen(slug), ...indices])].sort((a, b) => a - b);
    window.sessionStorage.setItem(seenStorageKey(slug), JSON.stringify(merged));
  } catch {
    // Storage is full or blocked: the next draw just may repeat questions.
  }
}
