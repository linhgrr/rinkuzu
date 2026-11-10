import { describe, expect, it } from 'vitest';
import {
  guestUploadReducer,
  initialGuestUploadState,
  type GuestUploadState,
} from './guest-upload-state';

const file = new File(['%PDF-'], 'notes.pdf', { type: 'application/pdf' });
const processing = { status: 'processing', percent: 10, questionCount: 0, title: null } as const;

function uploading(): GuestUploadState {
  const chosen = guestUploadReducer(
    guestUploadReducer(initialGuestUploadState, { type: 'check_started', file }),
    { type: 'check_finished', file, result: 'ok' },
  );
  return guestUploadReducer(chosen, { type: 'upload_started', token: 'fake-token', now: 0 });
}

describe('guestUploadReducer (RIN-1448)', () => {
  it('ignores the answer of a cancelled upload', () => {
    const started = uploading();
    const cancelled = guestUploadReducer(started, { type: 'cancelled' });
    const late = guestUploadReducer(cancelled, {
      type: 'progressed',
      run: started.run,
      progress: processing,
      now: 1,
    });
    expect(late.phase).toBe('chosen');
    expect(late.file).toBe(file);
  });

  it('fails a draft still processing after the timeout', () => {
    const started = uploading();
    const next = guestUploadReducer(started, {
      type: 'progressed',
      run: started.run,
      progress: processing,
      now: 120_001, // past the two-minute timeout
    });
    expect(next.phase).toBe('failed');
  });

  it('drops a refused PDF but keeps the file after an upload error', () => {
    const started = uploading();
    const tooLarge = guestUploadReducer(started, {
      type: 'upload_refused',
      run: started.run,
      refusal: 'too_large',
    });
    expect(tooLarge).toMatchObject({ phase: 'idle', file: null, alert: 'too_large' });
    const errored = guestUploadReducer(started, {
      type: 'upload_refused',
      run: started.run,
      refusal: 'upload_error',
    });
    expect(errored).toMatchObject({ phase: 'chosen', file, alert: 'upload_error' });
  });

  it('ignores a page check that finished after the file was removed', () => {
    const checking = guestUploadReducer(initialGuestUploadState, { type: 'check_started', file });
    const removed = guestUploadReducer(checking, { type: 'removed' });
    expect(guestUploadReducer(removed, { type: 'check_finished', file, result: 'ok' })).toBe(
      removed,
    );
  });
});
