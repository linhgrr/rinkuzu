import { describe, expect, it } from 'vitest';
import {
  reconcileDraftsWithServer,
  type DraftProgress,
  type DraftServerSyncItem,
} from './reconcile-drafts';

const NOW_MS = Date.parse('2026-07-06T03:03:00.000Z');

function localDraft(overrides: Partial<DraftProgress> = {}): DraftProgress {
  return {
    id: 'draft-1',
    title: 'Quiz draft',
    status: 'processing',
    chunksTotal: 1,
    chunksProcessed: 0,
    questionsCount: 0,
    createdAt: '2026-07-06T03:02:31.714Z',
    expiresAt: '2026-07-08T03:02:31.714Z',
    ...overrides,
  };
}

function serverDraft(overrides: Partial<DraftServerSyncItem> = {}): DraftServerSyncItem {
  return {
    id: 'draft-1',
    title: 'Quiz draft',
    status: 'processing',
    chunksTotal: 1,
    chunksProcessed: 0,
    questionsCount: 0,
    createdAt: '2026-07-06T03:02:31.714Z',
    expiresAt: '2026-07-08T03:02:31.714Z',
    ...overrides,
  };
}

describe('reconcileDraftsWithServer', () => {
  it('hydrates a processing draft returned by the server after local state lost it', () => {
    const result = reconcileDraftsWithServer({}, [serverDraft()], NOW_MS);

    expect(result['draft-1']).toEqual(serverDraft());
  });

  it('keeps a recent optimistic draft when an older server snapshot does not contain it', () => {
    const draft = localDraft();

    const result = reconcileDraftsWithServer({ [draft.id]: draft }, [], NOW_MS);

    expect(result[draft.id]).toEqual(draft);
  });

  it('removes a missing optimistic draft after the reconciliation grace period', () => {
    const draft = localDraft({ createdAt: '2026-07-06T03:00:00.000Z' });

    const result = reconcileDraftsWithServer({ [draft.id]: draft }, [], NOW_MS);

    expect(result).toEqual({});
  });

  it('updates an existing draft with authoritative server progress', () => {
    const draft = localDraft();
    const completed = serverDraft({
      status: 'completed',
      chunksProcessed: 1,
      questionsCount: 12,
    });

    const result = reconcileDraftsWithServer({ [draft.id]: draft }, [completed], NOW_MS);

    expect(result[draft.id]).toEqual(completed);
  });
});
