'use client';

import { useCallback, useEffect, useRef } from 'react';
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
  const slugRef = useRef(slug);
  const inFlightAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    slugRef.current = slug;
  }, [slug]);

  const clearDebounceTimer = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  const invalidateSaves = useCallback(() => {
    pendingRef.current = null;
    clearDebounceTimer();
    inFlightAbortRef.current?.abort();
    inFlightAbortRef.current = null;
  }, [clearDebounceTimer]);

  const loadProgress = useCallback(async (): Promise<SavedQuizProgress | null> => {
    if (!enabledRef.current) {
      return null;
    }

    try {
      return await loadSavedQuizProgress(slugRef.current);
    } catch {
      return null;
    }
  }, []);

  const flushSave = useCallback(async () => {
    clearDebounceTimer();

    const payload = pendingRef.current;
    if (!payload || !enabledRef.current) {
      return;
    }
    pendingRef.current = null;

    const controller = new AbortController();
    inFlightAbortRef.current = controller;

    try {
      await saveQuizProgress(slugRef.current, payload, { signal: controller.signal });
    } catch {
      // Best-effort; progress save failures are non-blocking.
    } finally {
      if (inFlightAbortRef.current === controller) {
        inFlightAbortRef.current = null;
      }
    }
  }, [clearDebounceTimer]);

  const saveProgress = useCallback(
    (payload: SavedQuizProgress) => {
      if (!enabledRef.current) {
        return;
      }

      pendingRef.current = payload;

      clearDebounceTimer();
      debounceRef.current = setTimeout(() => {
        void flushSave();
      }, debounceMs);
    },
    [clearDebounceTimer, debounceMs, flushSave],
  );

  const clearProgress = useCallback(async () => {
    invalidateSaves();

    if (!enabledRef.current) {
      return;
    }

    try {
      await deleteSavedQuizProgress(slugRef.current);
    } catch {
      // Best-effort.
    }
  }, [invalidateSaves]);

  // Flush pending progress on unmount so a mid-quiz navigation does not drop
  // answers. Uses keepalive (no AbortSignal) so the write can finish after
  // teardown without keeping a React-owned promise alive. clearProgress /
  // invalidateSaves null pending first, so submit/clear cannot resurrect.
  useEffect(() => {
    return () => {
      clearDebounceTimer();
      const payload = pendingRef.current;
      pendingRef.current = null;
      if (!payload || !enabledRef.current) {
        return;
      }

      void saveQuizProgress(slugRef.current, payload, { keepalive: true }).catch(() => {
        // Best-effort unmount flush.
      });
    };
  }, [clearDebounceTimer]);

  return { loadProgress, saveProgress, flushSave, clearProgress };
}
