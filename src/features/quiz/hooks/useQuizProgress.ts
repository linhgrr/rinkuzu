'use client';

import { useCallback, useEffect, useRef } from 'react';
import { fetchApiData } from '@/lib/api/client';
import { routePathSegment } from '@/lib/routing/routeParams';

type Answer = number | number[];

export interface SavedQuizProgress {
  questionOrder: number[];
  optionOrders: number[][];
  userAnswers: Answer[];
  currentQuestionIndex: number;
  answeredCount: number;
  totalQuestions: number;
}

interface UseQuizProgressOptions {
  slug: string;
  enabled: boolean;
  debounceMs?: number;
}

function buildProgressUrl(slug: string): string {
  return `/api/quiz/${routePathSegment(slug)}/progress`;
}

export function useQuizProgress({ slug, enabled, debounceMs = 1500 }: UseQuizProgressOptions) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<SavedQuizProgress | null>(null);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const loadProgress = useCallback(async (): Promise<SavedQuizProgress | null> => {
    if (!enabledRef.current) {
      return null;
    }

    try {
      const data = await fetchApiData<{ progress: SavedQuizProgress | null }>(
        buildProgressUrl(slug),
      );
      return data.progress ?? null;
    } catch {
      return null;
    }
  }, [slug]);

  const flushSave = useCallback(async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    const payload = pendingRef.current;
    if (!payload || !enabledRef.current) {
      return;
    }
    pendingRef.current = null;

    try {
      await fetchApiData(buildProgressUrl(slug), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch {
      // Best-effort; progress save failures are non-blocking.
    }
  }, [slug]);

  const saveProgress = useCallback(
    (payload: SavedQuizProgress) => {
      if (!enabledRef.current) {
        return;
      }

      pendingRef.current = payload;

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        void flushSave();
      }, debounceMs);
    },
    [debounceMs, flushSave],
  );

  const clearProgress = useCallback(async () => {
    pendingRef.current = null;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    if (!enabledRef.current) {
      return;
    }

    try {
      await fetchApiData(buildProgressUrl(slug), { method: 'DELETE' });
    } catch {
      // Best-effort.
    }
  }, [slug]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return { loadProgress, saveProgress, flushSave, clearProgress };
}
