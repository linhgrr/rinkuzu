import { slugifyText } from './slug';

export interface TocItem {
  id: string;
  text: string;
}

/**
 * Extract h2/h3 headings from markdown content as TocItem[].
 * Runs on the server — safe to use in generateMetadata and page components.
 */
export const extractHeadingsFromMarkdown = (content: string): TocItem[] => {
  const lines = content.split('\n');
  const headings: TocItem[] = [];

  for (const line of lines) {
    const h2Match = line.match(/^## (.+)$/);
    const h3Match = line.match(/^### (.+)$/);

    const h2Text = h2Match?.[1];
    const h3Text = h3Match?.[1];

    if (h2Text !== undefined) {
      headings.push({ id: slugifyText(h2Text), text: h2Text });
    } else if (h3Text !== undefined) {
      headings.push({ id: slugifyText(h3Text), text: h3Text });
    }
  }

  return headings;
};
