/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addGuestClaim, markGuestClaimReviewOptIn } from '@/features/quiz/lib/guest-claims';

vi.mock('@/lib/analytics/client', () => ({ captureAnalyticsEvent: vi.fn() }));

const TOKEN_A = 'A'.repeat(43);
const TOKEN_B = 'B'.repeat(43);
const fetchMock = vi.fn<typeof fetch>();

function storeClaim(attemptId: string, token: string) {
  addGuestClaim({ attemptId, token, quizSlug: 'fake-quiz', takenAt: Date.now() });
}

/** The claim runs once per page load, so every test gets a fresh module. */
async function claim() {
  vi.resetModules();
  const { claimStoredGuestAttempts } = await import('./guest-claim-api');
  await claimStoredGuestAttempts();
}

function sentBody(): { tokens: string[]; reviewOptInTokens?: string[] } {
  const [, init] = fetchMock.mock.calls[0] ?? [];
  return JSON.parse(String(init?.body));
}

describe('claimStoredGuestAttempts review opt-in (RIN-1712)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { claimedAttemptIds: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends reviewOptInTokens only for the marked entries', async () => {
    storeClaim('attempt-a', TOKEN_A);
    storeClaim('attempt-b', TOKEN_B);
    markGuestClaimReviewOptIn('attempt-b');

    await claim();

    const body = sentBody();
    expect([...body.tokens].sort()).toEqual([TOKEN_A, TOKEN_B]);
    expect(body.reviewOptInTokens).toEqual([TOKEN_B]);
  });

  it('leaves reviewOptInTokens out when nothing was marked', async () => {
    storeClaim('attempt-a', TOKEN_A);

    await claim();

    expect(sentBody()).toEqual({ tokens: [TOKEN_A] });
  });
});
