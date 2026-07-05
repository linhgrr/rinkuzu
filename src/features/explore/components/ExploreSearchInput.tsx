'use client';

import { useEffect, useState } from 'react';
import { HiOutlineSearch } from 'react-icons/hi';
import { Input } from '@/components/ui/Input';

interface ExploreSearchInputProps {
  initialQuery: string;
  placeholder: string;
  onCommit: (query: string) => void;
}

export function ExploreSearchInput({
  initialQuery,
  placeholder,
  onCommit,
}: ExploreSearchInputProps) {
  const [value, setValue] = useState(initialQuery);

  useEffect(() => {
    if (value.trim() === initialQuery) return;
    const timer = window.setTimeout(() => onCommit(value), 400);
    return () => window.clearTimeout(timer);
  }, [initialQuery, onCommit, value]);

  return (
    <div className="relative block max-w-3xl" role="search">
      <HiOutlineSearch
        className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-muted"
        aria-hidden="true"
      />
      <Input
        type="search"
        name="q"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onCommit(value);
        }}
        className="h-12 pl-12"
        aria-label={placeholder}
      />
    </div>
  );
}
