'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
}

const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const components: Components = {
  h2: ({ children }) => {
    const text = String(children);
    const id = slugify(text);
    return (
      <h2
        id={id}
        className="scroll-mt-24 text-2xl font-bold text-[#1e242c] mt-12 mb-6"
      >
        {children}
      </h2>
    );
  },
  h3: ({ children }) => {
    const text = String(children);
    const id = slugify(text);
    return (
      <h3
        id={id}
        className="scroll-mt-24 text-xl font-semibold text-[#1e242c] mt-8 mb-4"
      >
        {children}
      </h3>
    );
  },
  p: ({ children }) => (
    <p className="mb-6 leading-relaxed text-[#414d60]">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-6 mb-6 space-y-2 text-[#414d60]">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-6 mb-6 space-y-2 text-[#414d60]">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-1 text-[#414d60]">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-teal-500 pl-6 py-3 italic text-[#5a6470] bg-gray-50 rounded-r-xl my-8">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-8 ring-1 ring-gray-200 rounded-xl shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
  th: ({ children }) => (
    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-6 py-4 text-sm text-gray-600 border-t border-gray-100 align-top">
      {children}
    </td>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-gray-50 transition-colors">{children}</tr>
  ),
  code: ({ children, className }) => {
    // Inline code (no className = no language)
    if (!className) {
      return (
        <code className="bg-gray-100 text-teal-700 px-1.5 py-0.5 rounded font-mono text-sm">
          {children}
        </code>
      );
    }
    // Block code
    return (
      <code className={className}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl overflow-x-auto text-sm font-mono my-6">
      {children}
    </pre>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-teal-600 hover:text-teal-700 underline decoration-teal-600/30 hover:decoration-teal-600 underline-offset-4 transition-all"
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-[#1e242c]">{children}</strong>
  ),
  hr: () => <hr className="my-10 border-gray-200" />,
};

export const MarkdownRenderer = ({ content }: MarkdownRendererProps) => {
  return (
    <div className="text-base">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
};
