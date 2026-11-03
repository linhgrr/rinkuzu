import ReactMarkdown, { type Options } from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

/**
 * ReactMarkdown with the KaTeX pipeline (remark-math + rehype-katex + KaTeX CSS).
 * Loaded on demand by `MarkdownRenderer` only for content that `hasMath` flags,
 * so plain-text questions never download KaTeX (RIN-679). Math plugins run after
 * the caller's plugins, matching the order of the former static pipeline.
 */
export function MathMarkdown({ remarkPlugins = [], rehypePlugins = [], ...props }: Options) {
  return (
    <ReactMarkdown
      {...props}
      remarkPlugins={[...remarkPlugins, remarkMath]}
      rehypePlugins={[...rehypePlugins, rehypeKatex]}
    />
  );
}
