export interface StableContentEntry {
  content: string;
  key: string;
  sourceIndex: number;
}

/**
 * Produces reorder-safe React keys for content lists while still supporting
 * duplicate values. Equal duplicate values are indistinguishable in the UI,
 * so their occurrence number is stable for every observable ordering.
 */
export function toStableContentEntries(contents: readonly string[]): StableContentEntry[] {
  const occurrences = new Map<string, number>();

  return contents.map((content, sourceIndex) => {
    const occurrence = occurrences.get(content) ?? 0;
    occurrences.set(content, occurrence + 1);

    return {
      content,
      key: JSON.stringify([content, occurrence]),
      sourceIndex,
    };
  });
}
