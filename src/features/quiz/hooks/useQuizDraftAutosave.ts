'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { QuizEditorWorkspaceSubmitPayload } from '@/features/quiz/components/editor/QuizEditorWorkspace';
import { ApiResponseError } from '@/lib/api/client';
import { patchQuizDraft } from '@/lib/quiz/draftApi';

const AUTOSAVE_DELAY_MS = 1000;

export type QuizDraftAutosaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict';

interface RecoverySnapshot {
  baseRevision: number;
  payload: QuizEditorWorkspaceSubmitPayload;
  savedAt: string;
}

function storageKey(draftId: string) {
  return `quiz-draft-recovery:${draftId}`;
}

function readRecoverySnapshot(draftId: string, revision: number): RecoverySnapshot | null {
  try {
    const raw = window.localStorage.getItem(storageKey(draftId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<RecoverySnapshot>;
    if (
      value.baseRevision !== revision ||
      !value.payload ||
      typeof value.payload.title !== 'string' ||
      !Array.isArray(value.payload.questions) ||
      typeof value.savedAt !== 'string'
    ) {
      window.localStorage.removeItem(storageKey(draftId));
      return null;
    }
    return value as RecoverySnapshot;
  } catch {
    window.localStorage.removeItem(storageKey(draftId));
    return null;
  }
}

export function useQuizDraftAutosave(draftId: string, initialRevision: number) {
  const revisionRef = useRef(initialRevision);
  const pendingRef = useRef<QuizEditorWorkspaceSubmitPayload | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const blockedRef = useRef<'error' | 'conflict' | null>(null);
  const drainRef = useRef<() => Promise<void>>(async () => undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<QuizDraftAutosaveStatus>('idle');
  const [recovery, setRecovery] = useState<RecoverySnapshot | null>(() =>
    typeof window === 'undefined' ? null : readRecoverySnapshot(draftId, initialRevision),
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const persistRecovery = useCallback(
    (payload: QuizEditorWorkspaceSubmitPayload) => {
      window.localStorage.setItem(
        storageKey(draftId),
        JSON.stringify({
          baseRevision: revisionRef.current,
          payload,
          savedAt: new Date().toISOString(),
        } satisfies RecoverySnapshot),
      );
    },
    [draftId],
  );

  const drain = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current;
    const payload = pendingRef.current;
    if (!payload || blockedRef.current === 'conflict') return;
    pendingRef.current = null;
    setStatus('saving');

    const request = (async () => {
      try {
        const saved = await patchQuizDraft(draftId, {
          title: payload.title,
          description: payload.description,
          folderId: payload.selectedFolderId,
          submitToPremium: payload.submitToPremium,
          questions: payload.questions,
          expectedRevision: revisionRef.current,
        });
        revisionRef.current = saved.revision;
        blockedRef.current = null;
        const savedAt = new Date().toISOString();
        setLastSavedAt(savedAt);
        if (pendingRef.current) {
          persistRecovery(pendingRef.current);
          setStatus('dirty');
          timerRef.current = setTimeout(() => {
            timerRef.current = null;
            void drainRef.current();
          }, AUTOSAVE_DELAY_MS);
        } else {
          window.localStorage.removeItem(storageKey(draftId));
          setStatus('saved');
        }
      } catch (error) {
        pendingRef.current = payload;
        persistRecovery(payload);
        const nextStatus =
          error instanceof ApiResponseError && error.status === 409 ? 'conflict' : 'error';
        blockedRef.current = nextStatus;
        setStatus(nextStatus);
      } finally {
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = request;
    await request;
  }, [draftId, persistRecovery]);

  useEffect(() => {
    drainRef.current = drain;
  }, [drain]);

  const queueSave = useCallback(
    (payload: QuizEditorWorkspaceSubmitPayload) => {
      if (blockedRef.current === 'conflict') return;
      blockedRef.current = null;
      pendingRef.current = payload;
      persistRecovery(payload);
      setStatus('dirty');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void drainRef.current();
      }, AUTOSAVE_DELAY_MS);
    },
    [persistRecovery],
  );

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    while (pendingRef.current || inFlightRef.current) {
      if (inFlightRef.current) await inFlightRef.current;
      else await drain();
      if (blockedRef.current) break;
    }
  }, [drain]);

  const restoreRecovery = useCallback(() => {
    if (!recovery) return null;
    const payload = recovery.payload;
    setRecovery(null);
    queueSave(payload);
    return payload;
  }, [queueSave, recovery]);

  const discardRecovery = useCallback(() => {
    window.localStorage.removeItem(storageKey(draftId));
    setRecovery(null);
  }, [draftId]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return {
    status,
    recovery,
    lastSavedAt,
    queueSave,
    flush,
    restoreRecovery,
    discardRecovery,
  };
}
