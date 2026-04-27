'use client';

import { useState, useEffect } from 'react';
import type { TocItem } from '@/lib/blog-utils';

interface TableOfContentsProps {
  headings: TocItem[];
}

export const TableOfContents = ({ headings }: TableOfContentsProps) => {
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

    headings.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [headings]);

  return (
    <nav className="space-y-1" aria-label="Table of contents">
      <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4">
        Table of Contents
      </h4>
      <ul className="space-y-3">
        {headings.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={`block text-sm transition-all duration-200 border-l-2 pl-4 py-1 ${
                activeId === item.id
                  ? 'border-brand-trust text-brand-trust font-medium translate-x-1'
                  : 'border-transparent text-neutral-500 hover:text-neutral-900 hover:border-neutral-200'
              }`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(item.id)?.scrollIntoView({
                  behavior: 'smooth',
                });
              }}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};
