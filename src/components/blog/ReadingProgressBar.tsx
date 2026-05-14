'use client';

import React, { useEffect, useState } from 'react';

export const ReadingProgressBar = () => {
  const [completion, setCompletion] = useState(0);

  useEffect(() => {
    const updateScrollCompletion = () => {
      const currentProgress = window.scrollY;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const nextCompletion = scrollHeight > 0 ? (currentProgress / scrollHeight) * 100 : 0;
      setCompletion(Math.min(100, Math.max(0, nextCompletion)));
    };

    updateScrollCompletion();
    window.addEventListener('scroll', updateScrollCompletion, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateScrollCompletion);
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
