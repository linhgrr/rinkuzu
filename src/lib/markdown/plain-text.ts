import { toString } from 'mdast-util-to-string';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { normalizeMarkdownContent } from './normalize';

const markdownParser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

export function markdownToPlainText(content: string): string {
  const normalizedContent = normalizeMarkdownContent(content);

  if (!normalizedContent) {
    return normalizedContent;
  }

  const tree = markdownParser.parse(normalizedContent);

  return tree.children
    .map((node) => toString(node))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
