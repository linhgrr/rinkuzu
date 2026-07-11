'use client';

import { useEffect, useRef } from 'react';
import {
  deleteSavedQuizProgress,
  loadSavedQuizProgress,
  saveQuizProgress,
} from '@/features/quiz/api/quiz-interaction-api';
import type { SavedQuizProgress } from '@/features/quiz/types/quiz-interaction-view-model';

interface UseQuizProgressOptions {
  slug: string;
  enabled: boolean;
  debounceMs?: number;
}

export function useQuizProgress({ slug, enabled, debounceMs = 1500 }: UseQuizProgressOptions) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<SavedQuizProgress | null>(null);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const loadProgress = async (): Promise<SavedQuizProgress | null> => {
    if (!enabledRef.current) {
      return null;
    }

    try {
      return await loadSavedQuizProgress(slug);
    } catch {
      return null;
    }
  };

  const flushSave = async () => {
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
      await saveQuizProgress(slug, payload);
    } catch {
      // Best-effort; progress save failures are non-blocking.
    }
  };

  const saveProgress = (payload: SavedQuizProgress) => {
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
  };

  const clearProgress = async () => {
    pendingRef.current = null;
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    if (!enabledRef.current) {
      return;
    }

    try {
      await deleteSavedQuizProgress(slug);
    } catch {
      // Best-effort.
    }
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return { loadProgress, saveProgress, flushSave, clearProgress };
}
