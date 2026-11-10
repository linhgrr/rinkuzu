import { describe, expect, it, vi } from 'vitest';

import { createGuestDraftEvents } from '@/lib/guest-draft/events';

const context = {
  draftId: '6730a0000000000000000001',
  locale: 'vi' as const,
  entry: 'blog' as const,
};

describe('createGuestDraftEvents', () => {
  it('sends started / ready / failed with locale, entry and reason only', async () => {
    const capture = vi.fn(async () => true);
    const events = createGuestDraftEvents(capture);

    await events.started(context);
    await events.ready(context);
    await events.failed(context, 'ocr_failed');

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
    ]);
    for (const [, , properties] of capture.mock.calls as unknown as [string, string, object][]) {
      expect(Object.keys(properties)).not.toEqual(
        expect.arrayContaining(['ip', 'token', 'fileName', 'title']),
      );
    }
  });
});
