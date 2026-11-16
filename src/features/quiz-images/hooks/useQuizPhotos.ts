'use client';

import { useEffect, useRef, useState } from 'react';
import {
  prepareQuizImage,
  QUIZ_IMAGE_MAX_COUNT,
  QUIZ_IMAGE_MAX_TOTAL_BYTES,
} from '@/features/quiz-images/lib/prepare-quiz-image';
import {
  QuizImageError,
  type QuizImageErrorReason,
} from '@/features/quiz-images/lib/quiz-image-error';
import { reportUploadRejection } from '@/lib/upload-rejection-client';
import { GUEST_DRAFT_MAX_IMAGE_BYTES } from '@/shared/constants/guest-draft';
import type { UploadRejectionReason, UploadSurface } from '@/shared/constants/upload-counters';

/** Photos prepared at once; a low-end phone runs out of memory above this (RIN-1790). */
const PREPARE_CONCURRENCY = 2;

export type QuizPhoto =
  | { id: string; status: 'preparing' }
  | { id: string; status: 'ready'; blob: Blob; bytes: number; thumbnailUrl: string }
  | { id: string; status: 'error'; reason: QuizImageErrorReason };

/** What the live region says after the learner changed the list (UI spec RIN-1791, section 2). */
export type QuizPhotoAnnouncement =
  { kind: 'moved'; page: number; position: number } | { kind: 'removed' };

/** A pick that did not fit: `added` photos were taken, the rest dropped (spec `too_many`). */
export interface QuizPhotoOverflow {
  added: number;
  free: number;
}

/** Where focus goes after the list changed: a row's button, or the add control. */
export type QuizPhotoFocus = { id: string; action: 'label' | 'up' | 'down' | 'remove' } | 'add';

/** Refusals as the counted reasons of the upload counters (RIN-1785). */
const REPORT_REASON: Record<QuizImageErrorReason, UploadRejectionReason> = {
  unsupported_type: 'wrong_type',
  too_large: 'too_large',
  undecodable: 'corrupt',
  too_many: 'too_many_pages',
  total_too_large: 'too_large',
};

let photoSeq = 0;
const nextId = () => `photo-${++photoSeq}`;

const isCounted = (photo: QuizPhoto) => photo.status !== 'error';

function revoke(photo: QuizPhoto | undefined): void {
  if (photo?.status === 'ready') URL.revokeObjectURL(photo.thumbnailUrl);
}

/** Swaps a photo with its neighbour among the photos that count; error rows stay out of the way. */
function moved(photos: readonly QuizPhoto[], id: string, delta: -1 | 1): QuizPhoto[] | null {
  const from = photos.findIndex((photo) => photo.id === id);
  if (from === -1 || !isCounted(photos[from] as QuizPhoto)) return null;
  let to = from + delta;
  while (photos[to] && !isCounted(photos[to] as QuizPhoto)) to += delta;
  if (!photos[to]) return null;
  const next = [...photos];
  [next[from], next[to]] = [next[to] as QuizPhoto, next[from] as QuizPhoto];
  return next;
}

export function readyBytes(photos: readonly QuizPhoto[]): number {
  return photos.reduce((sum, photo) => sum + (photo.status === 'ready' ? photo.bytes : 0), 0);
}

/**
 * The photo list of a photo-to-quiz page (RIN-1793, shared with the signed-in page): picks are
 * prepared in the browser (RIN-1790) at most two at a time, each as its own row so one bad
 * photo shows its own error and the others stay. Rows that failed do not count toward the 5.
 * Thumbnails are object URLs, revoked when a photo is removed and when the list unmounts.
 * Every browser-side refusal is counted on `surface` (RIN-1785): reason and size only.
 */
export function useQuizPhotos(surface: UploadSurface) {
  const [photos, setPhotos] = useState<QuizPhoto[]>([]);
  const [overflow, setOverflow] = useState<QuizPhotoOverflow | null>(null);
  const [announcement, setAnnouncement] = useState<QuizPhotoAnnouncement | null>(null);
  const [focus, setFocus] = useState<QuizPhotoFocus | null>(null);
  const photosRef = useRef<QuizPhoto[]>([]);
  const queueRef = useRef<{ id: string; file: File }[]>([]);
  const activeRef = useRef(0);
  const aliveRef = useRef(false);

  const commit = (next: QuizPhoto[]) => {
    photosRef.current = next;
    setPhotos(next);
  };

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      queueRef.current = [];
      photosRef.current.forEach(revoke);
      photosRef.current = [];
    };
  }, []);

  const finish = (id: string, outcome: QuizPhoto) => {
    const current = photosRef.current;
    if (!aliveRef.current || !current.some((photo) => photo.id === id)) {
      revoke(outcome); // removed or unmounted while it was being prepared
      return;
    }
    commit(current.map((photo) => (photo.id === id ? outcome : photo)));
  };

  const refuse = (id: string, file: File, reason: QuizImageErrorReason) => {
    reportUploadRejection({ file, reason: REPORT_REASON[reason], surface });
    finish(id, { id, status: 'error', reason });
  };

  const prepare = async (id: string, file: File) => {
    try {
      const prepared = await prepareQuizImage(file);
      const others = readyBytes(photosRef.current);
      if (
        prepared.bytes > GUEST_DRAFT_MAX_IMAGE_BYTES ||
        others + prepared.bytes > QUIZ_IMAGE_MAX_TOTAL_BYTES
      ) {
        URL.revokeObjectURL(prepared.thumbnailUrl);
        refuse(id, file, 'total_too_large');
        return;
      }
      finish(id, {
        id,
        status: 'ready',
        blob: prepared.blob,
        bytes: prepared.bytes,
        thumbnailUrl: prepared.thumbnailUrl,
      });
    } catch (error) {
      refuse(id, file, error instanceof QuizImageError ? error.reason : 'undecodable');
    }
  };

  const pump = () => {
    while (activeRef.current < PREPARE_CONCURRENCY && queueRef.current.length > 0) {
      const job = queueRef.current.shift();
      if (!job) return;
      if (!photosRef.current.some((photo) => photo.id === job.id)) continue; // removed while waiting
      activeRef.current += 1;
      void prepare(job.id, job.file).finally(() => {
        activeRef.current -= 1;
        pump();
      });
    }
  };

  const add = (files: readonly File[]) => {
    if (files.length === 0) return;
    const free = Math.max(0, QUIZ_IMAGE_MAX_COUNT - photosRef.current.filter(isCounted).length);
    const accepted = files.slice(0, free);
    setOverflow(files.length > free ? { added: accepted.length, free } : null);
    setAnnouncement(null);
    if (accepted.length === 0) return;
    const rows = accepted.map((file) => ({ id: nextId(), file }));
    const first = rows[0];
    commit([
      ...photosRef.current,
      ...rows.map((row): QuizPhoto => ({ id: row.id, status: 'preparing' })),
    ]);
    if (first) setFocus({ id: first.id, action: 'label' });
    queueRef.current.push(...rows);
    pump();
  };

  const remove = (id: string) => {
    const current = photosRef.current;
    const index = current.findIndex((photo) => photo.id === id);
    if (index === -1) return;
    revoke(current[index]);
    const next = current.filter((photo) => photo.id !== id);
    commit(next);
    const neighbour = next[index] ?? next[index - 1];
    setFocus(neighbour ? { id: neighbour.id, action: 'remove' } : 'add');
    setOverflow(null);
    setAnnouncement({ kind: 'removed' });
  };

  const move = (id: string, delta: -1 | 1) => {
    const next = moved(photosRef.current, id, delta);
    if (!next) return;
    commit(next);
    const counted = next.filter(isCounted);
    const position = counted.findIndex((photo) => photo.id === id) + 1;
    const page = position - delta;
    setAnnouncement({ kind: 'moved', page, position });
    setFocus({ id, action: delta === -1 ? 'up' : 'down' });
  };

  const clear = () => {
    photosRef.current.forEach(revoke);
    queueRef.current = [];
    commit([]);
    setOverflow(null);
    setAnnouncement(null);
  };

  const counted = photos.filter(isCounted);
  const ready = counted.filter(
    (photo): photo is Extract<QuizPhoto, { status: 'ready' }> => photo.status === 'ready',
  );
  const preparing = counted.length - ready.length;
  const failed = photos.length - counted.length;

  return {
    photos,
    /** The prepared JPEGs in page order; only meaningful when `canSubmit`. */
    blobs: ready.map((photo) => photo.blob),
    readyCount: ready.length,
    totalBytes: readyBytes(photos),
    preparing,
    failed,
    full: counted.length >= QUIZ_IMAGE_MAX_COUNT,
    canSubmit: ready.length > 0 && preparing === 0 && failed === 0,
    overflow,
    announcement,
    focus,
    clearFocus: () => setFocus(null),
    dismissOverflow: () => setOverflow(null),
    add,
    remove,
    move,
    clear,
  };
}

export type QuizPhotosState = ReturnType<typeof useQuizPhotos>;
