import { memo } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/utils';
import { normalizeMarkdownContent } from '@/lib/markdown/normalize';

type MarkdownRendererVariant = 'document' | 'prompt' | 'option' | 'answer' | 'compact';

export interface MarkdownRendererProps {
  content: string;
  className?: string;
  variant?: MarkdownRendererVariant;
}

const variantClasses: Record<MarkdownRendererVariant, string> = {
  document:
    '[&_h1]:mb-3 [&_h1]:mt-4 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-neutral-900 [&_h1:first-child]:mt-0 [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-neutral-900 [&_h2:first-child]:mt-0 [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-neutral-900 [&_h3:first-child]:mt-0 [&_p]:mb-2 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-neutral-700 [&_p:last-child]:mb-0 [&_li]:text-sm [&_li]:text-neutral-700',
  prompt:
    'text-base font-medium leading-relaxed text-inherit [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_p]:mb-2 [&_p]:text-inherit [&_p:last-child]:mb-0 [&_li]:text-inherit',
  option:
    'text-sm leading-relaxed text-inherit [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_p]:m-0 [&_p]:text-inherit [&_li]:text-inherit',
  answer:
    'text-sm leading-relaxed text-inherit [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_p]:m-0 [&_p]:text-inherit [&_li]:text-inherit',
  compact:
    'text-sm leading-relaxed text-inherit [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_p]:m-0 [&_p]:text-inherit [&_li]:text-inherit',
};

const QUESTION_DISALLOWED_ELEMENTS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
const OPTION_DISALLOWED_ELEMENTS = [...QUESTION_DISALLOWED_ELEMENTS, 'a'];

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  className,
  variant = 'document',
}: MarkdownRendererProps) {
  const normalizedContent = normalizeMarkdownContent(content);
  const disallowedElements =
    variant === 'document'
      ? undefined
      : variant === 'option'
        ? OPTION_DISALLOWED_ELEMENTS
        : QUESTION_DISALLOWED_ELEMENTS;

  return (
    <div
      className={cn(
        'max-w-none break-words [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden',
        variantClasses[variant],
        className,
      )}
      data-rich-text={variant}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        skipHtml
        urlTransform={defaultUrlTransform}
        {...(disallowedElements ? { disallowedElements, unwrapDisallowed: true } : {})}
        components={{
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 mb-3 ml-2">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 mb-3 ml-2">{children}</ol>
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children }) => (
            <code className="bg-neutral-100 text-neutral-900 px-1 py-0.5 rounded text-xs font-mono">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="bg-neutral-50 border border-neutral-200 rounded-md p-3 overflow-x-auto mb-3">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-neutral-300 my-4" />,
          table: ({ children }) => (
            <div className="overflow-x-auto mb-3">
              <table className="min-w-full border border-neutral-200 rounded-md">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-neutral-50">{children}</thead>,
          tbody: ({ children }) => <tbody className="bg-white">{children}</tbody>,
          tr: ({ children }) => <tr className="border-b border-neutral-200">{children}</tr>,
          th: ({ children }) => (
            <th className="px-3 py-2 text-left text-xs font-medium text-neutral-900 border-r border-neutral-200 last:border-r-0">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-sm text-neutral-700 border-r border-neutral-200 last:border-r-0">
              {children}
            </td>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-trust hover:text-green-700 underline"
            >
              {children}
            </a>
          ),
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
});
