import { describe, expect, it, vi } from 'vitest';

import { createGuestDraftEvents } from '@/lib/guest-draft/events';

const context = {
  draftId: '6730a0000000000000000001',
  locale: 'vi' as const,
  entry: 'blog' as const,
};

describe('createGuestDraftEvents', () => {
  it('sends started / ready / failed / claimed with locale, entry and reason only', async () => {
    const capture = vi.fn(async () => true);
    const events = createGuestDraftEvents(capture);

    await events.started(context);
    await events.ready(context);
    await events.failed(context, 'ocr_failed');
    await events.claimed(context);

    const base = {
      locale: 'vi',
      entry: 'blog',
      $process_person_profile: false,
      $geoip_disable: true,
    };
    expect(capture.mock.calls).toEqual([
      ['guest_draft_started', 'guest_draft:6730a0000000000000000001', base],
      ['guest_draft_ready', 'guest_draft:6730a0000000000000000001', base],
      [
        'guest_draft_failed',
        'guest_draft:6730a0000000000000000001',
        { ...base, reason: 'ocr_failed' },
      ],
      ['guest_draft_claimed', 'guest_draft:6730a0000000000000000001', base],
    ]);
    const sentKeys = capture.mock.calls.flatMap((call) => Object.keys(call.at(2) ?? {}));
    for (const forbidden of ['ip', 'token', 'fileName', 'title']) {
      expect(sentKeys).not.toContain(forbidden);
    }
  });
});
