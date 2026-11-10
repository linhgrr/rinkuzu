// Fenced code blocks of a Markdown blog body (CommonMark: ``` or ~~~, closed by
// the same character at least as long). Shared by the body-safety check and the
// `<TryQuiz />` splitter so both skip code the same way.

const FENCE_PATTERN = /^\s*(`{3,}|~{3,})/;

export type Fence = { char: string; length: number };

export const openingFence = (line: string): Fence | undefined => {
  const marker = FENCE_PATTERN.exec(line)?.[1];
  return marker ? { char: marker.charAt(0), length: marker.length } : undefined;
};

export const closesFence = (line: string, fence: Fence): boolean => {
  const marker = FENCE_PATTERN.exec(line)?.[1];
  return (
    marker !== undefined &&
    marker.charAt(0) === fence.char &&
    marker.length >= fence.length &&
    line.trim() === marker
  );
};
