import { createHeadingSlugger } from './slug';

export interface TocItem {
  id: string;
  text: string;
}

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;

/**
 * Extract h2/h3 headings from markdown content as TocItem[].
 * Runs on the server — safe to use in generateMetadata and page components.
 * Ids match the ones `MarkdownRenderer` gives headings with `headingIds`.
 */
export const extractHeadingsFromMarkdown = (content: string): TocItem[] => {
  const lines = content.split('\n');
  const headings: TocItem[] = [];
  const slug = createHeadingSlugger();
  let openFence: string | null = null;

  for (const line of lines) {
    const fence = line.match(FENCE)?.[1];
    if (fence !== undefined) {
      if (openFence === null) {
        openFence = fence;
      } else if (fence[0] === openFence[0] && fence.length >= openFence.length) {
        openFence = null;
      }
      continue;
    }
    if (openFence !== null) {
      continue;
    }

    const text = line.match(/^###? (.+)$/)?.[1];
    if (text !== undefined) {
      headings.push({ id: slug(text), text });
    }
  }

  return headings;
};
