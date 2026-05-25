'use client';

import React, { useEffect, useState } from 'react';

const computeCompletion = () => {
  if (typeof window === 'undefined') return 0;
  const currentProgress = window.scrollY;
  const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
  const next = scrollHeight > 0 ? (currentProgress / scrollHeight) * 100 : 0;
  return Math.min(100, Math.max(0, next));
};

export const ReadingProgressBar = () => {
  const [completion, setCompletion] = useState<number>(() => computeCompletion());

  useEffect(() => {
    const update = () => setCompletion(computeCompletion());
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
    };
  }, []);

  return (
    <div className="fixed top-0 left-0 z-50 h-1 w-full bg-transparent">
      <div
        className="h-full bg-primary transition-all duration-150 ease-out"
        style={{ width: `${completion}%` }}
      />
    </div>
  );
};
