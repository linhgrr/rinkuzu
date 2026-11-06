/** @vitest-environment jsdom */

import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GUEST_CLAIMS_STORAGE_KEY, addGuestClaim } from '@/features/quiz/lib/guest-claims';

const { captureMock, session } = vi.hoisted(() => ({
  captureMock: vi.fn(),
  session: { value: { data: null, status: 'unauthenticated' } as object },
}));

vi.mock('next-auth/react', () => ({ useSession: () => session.value }));
vi.mock('@/lib/analytics/client', () => ({
  captureAnalyticsEvent: (...args: unknown[]) => captureMock(...args),
}));

const TOKEN_A = 'A'.repeat(43);
const TOKEN_B = 'B'.repeat(43);
const HOUR = 60 * 60 * 1000;

function storeClaim(attemptId: string, token: string, takenAt = Date.now()) {
  addGuestClaim({ attemptId, token, quizSlug: 'fake-quiz', takenAt });
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fetchMock = vi.fn<typeof fetch>();

/** The claim runs once per page load, so every test gets a fresh module. */
async function renderClaimer() {
  vi.resetModules();
  const { GuestAttemptClaimer } = await import('./GuestAttemptClaimer');
  const view = render(<GuestAttemptClaimer />);
  return { rerender: () => view.rerender(<GuestAttemptClaimer key="again" />) };
}

function signIn() {
  session.value = { data: { user: { id: 'user-1' } }, status: 'authenticated' };
}

describe('GuestAttemptClaimer (RIN-921)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    session.value = { data: null, status: 'unauthenticated' };
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the fresh tokens once after sign-in, clears storage and reports the count only', async () => {
    storeClaim('attempt-1', TOKEN_A);
    storeClaim('attempt-old', TOKEN_B, Date.now() - 25 * HOUR);
    signIn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { success: true, data: { claimedAttemptIds: ['attempt-1'] } }),
    );

    const view = await renderClaimer();
    await waitFor(() => expect(window.localStorage.getItem(GUEST_CLAIMS_STORAGE_KEY)).toBeNull());
    // Remounting in the same page load does not claim again.
    view.rerender();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/attempts/claim');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ tokens: [TOKEN_A] });
    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(captureMock).toHaveBeenCalledWith('guest_attempt_claimed', { count: 1 });
  });

  it('clears the tokens even when the server claimed none, without an event', async () => {
    storeClaim('attempt-1', TOKEN_A);
    signIn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { success: true, data: { claimedAttemptIds: [] } }),
    );

    await renderClaimer();

    await waitFor(() => expect(window.localStorage.getItem(GUEST_CLAIMS_STORAGE_KEY)).toBeNull());
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('does not post while signed out', async () => {
    storeClaim('attempt-1', TOKEN_A);

    await renderClaimer();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(GUEST_CLAIMS_STORAGE_KEY)).not.toBeNull();
  });

  it('does not post when the browser holds no claims', async () => {
    signIn();

    await renderClaimer();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the tokens for the next load on a 429', async () => {
    storeClaim('attempt-1', TOKEN_A);
    signIn();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(429, {
        success: false,
        error: { code: 'rate_limited', message: 'Too many requests' },
      }),
    );

    await renderClaimer();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(JSON.parse(window.localStorage.getItem(GUEST_CLAIMS_STORAGE_KEY) ?? '[]')).toHaveLength(
      1,
    );
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('keeps the tokens on a network error', async () => {
    storeClaim('attempt-1', TOKEN_A);
    signIn();
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await renderClaimer();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(window.localStorage.getItem(GUEST_CLAIMS_STORAGE_KEY)).not.toBeNull();
  });
});
