'use client';

import { useEffect, useState } from 'react';

interface UseCategorySearchOptions {
  initialQuery?: string;
  delay?: number;
}

export function useCategorySearch(options: UseCategorySearchOptions = {}) {
  const { initialQuery = '', delay = 300 } = options;
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(query);
    }, delay);

    return () => clearTimeout(timeout);
  }, [query, delay]);

  const reset = () => {
    setQuery('');
    setDebouncedQuery('');
  };

  return {
    query,
    setQuery,
    debouncedQuery,
    reset,
  };
}
