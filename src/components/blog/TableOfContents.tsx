'use client';

import { useState, useEffect } from 'react';
import type { TocItem } from '@/lib/blog-utils';

interface TableOfContentsProps {
  headings: TocItem[];
  /** Localized heading, from the `blog` messages (RIN-1387). */
  title: string;
}

export const TableOfContents = ({ headings, title }: TableOfContentsProps) => {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-100px 0px -70% 0px',
        threshold: 0,
      },
    );

    const targets = headings
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => element !== null);
    for (const element of targets) observer.observe(element);

    return () => observer.disconnect();
  }, [headings]);

  return (
    <nav className="space-y-1" aria-labelledby="toc-heading">
      <h4
        id="toc-heading"
        className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-4"
      >
        {title}
      </h4>
      <ul className="space-y-2">
        {headings.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`flex min-h-11 w-full items-center border-l-2 pl-4 py-2 text-left text-sm transition-all duration-200 ${
                activeId === item.id
                  ? 'border-brand-trust text-brand-trust font-medium translate-x-1'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900 hover:border-neutral-200'
              }`}
              onClick={() => {
                document.getElementById(item.id)?.scrollIntoView({
                  behavior: 'smooth',
                });
              }}
            >
              {item.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};
