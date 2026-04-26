import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const LATEX_ESCAPE_RECOVERY_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\u0008(?=(eta|egin|ig|oxed|ullet|ar))/g, replacement: '\\b' },
  { pattern: /\u000c(?=(rac|orall|ootnotesize|box))/g, replacement: '\\f' },
  { pattern: /\n(?=(abla|eq|e|ewline|otin|ormalsize))/g, replacement: '\\n' },
  { pattern: /\r(?=(ho|ight|ightarrow|ightarrowtail|ightleftharpoons|ightleftharpoons|ightparen|ightangle|ighttriangle))/g, replacement: '\\r' },
  { pattern: /\t(?=(ext|imes|heta|au|an|o|riangle|extbf|extit|ilde))/g, replacement: '\\t' },
]

function normalizeLatexEscapes(content: string): string {
  if (!content)
    return content

  return LATEX_ESCAPE_RECOVERY_PATTERNS.reduce(
    (value, { pattern, replacement }) => value.replace(pattern, replacement),
    content,
  )
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const normalizedContent = normalizeLatexEscapes(content)

  return (
    <div className={cn('max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-lg font-bold text-neutral-900 mb-3 mt-4 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold text-neutral-900 mb-2 mt-3 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-medium text-neutral-900 mb-2 mt-3 first:mt-0">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-sm text-neutral-700 mb-2 leading-relaxed">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 mb-3 ml-2">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-sm text-neutral-700">
              {children}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-neutral-900">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-neutral-800">
              {children}
            </em>
          ),
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
            <blockquote className="border-l-4 border-green-200 pl-4 py-2 bg-green-50 mb-3 rounded-r">
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr className="border-neutral-300 my-4" />
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-3">
              <table className="min-w-full border border-neutral-200 rounded-md">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-neutral-50">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="bg-white">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="border-b border-neutral-200">
              {children}
            </tr>
          ),
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
}
