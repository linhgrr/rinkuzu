import { createHeadingSlugger } from '@/lib/slug';

/** The slice of a hast node this plugin reads; avoids a direct `@types/hast` dependency. */
interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

const ANCHORED_HEADINGS = new Set(['h2', 'h3']);

function textContent(node: HastNode): string {
  if (node.type === 'text') {
    return node.value ?? '';
  }
  return (node.children ?? []).map(textContent).join('');
}

function assignIds(node: HastNode, slug: (text: string) => string): void {
  if (node.type === 'element' && node.tagName && ANCHORED_HEADINGS.has(node.tagName)) {
    node.properties = { ...node.properties, id: slug(textContent(node)) };
    return;
  }
  for (const child of node.children ?? []) {
    assignIds(child, slug);
  }
}

/**
 * Rehype plugin: give h2/h3 the same ids `extractHeadingsFromMarkdown`
 * produces for the blog TOC (shared slugger, document order, `-2` on repeats).
 * Run it before rehype-katex so math headings slug from their source text.
 */
export function rehypeHeadingIds() {
  return (tree: HastNode) => {
    assignIds(tree, createHeadingSlugger());
  };
}
