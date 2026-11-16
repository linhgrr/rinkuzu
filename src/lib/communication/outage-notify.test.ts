import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OutboundCommunicationEmail } from './resend';

const logs = vi.hoisted(() => ({ lines: [] as unknown[][] }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/logger', () => ({
  logger: {
    info: (...args: unknown[]) => logs.lines.push(args),
    warn: (...args: unknown[]) => logs.lines.push(args),
    error: (...args: unknown[]) => logs.lines.push(args),
  },
}));
vi.mock('./outage-notify-template', () => ({
  renderOutageNotify: async (input: { locale: string; ctaUrl: string }) => ({
    subject: `subject-${input.locale}`,
    html: `<a href="${input.ctaUrl}">${input.locale}</a>`,
    text: input.ctaUrl,
  }),
}));

const { outageNotifyCampaign, runOutageNotifySend } = await import('./outage-notify');
type Row = { id: string; email: string; locale: string };

const CAMPAIGN = '2026-11-vercel';

/** The API's list (RIN-1650): pending rows oldest first, mark-sent idempotent. */
class FakeList {
  readonly rows: (Row & { sent: boolean })[];
  pendingCalls = 0;
  markSentCalls: string[][] = [];

  constructor(rows: Row[]) {
    this.rows = rows.map((row) => ({ ...row, sent: false }));
  }

  async pending(_campaign: string, limit: number): Promise<Row[]> {
    this.pendingCalls += 1;
    return this.rows
      .filter((row) => !row.sent)
      .slice(0, limit)
      .map(({ id, email, locale }) => ({ id, email, locale }));
  }

  async pendingCount(): Promise<number> {
    return this.rows.filter((row) => !row.sent).length;
  }

  async markSent(ids: readonly string[]): Promise<void> {
    this.markSentCalls.push([...ids]);
    for (const row of this.rows) if (ids.includes(row.id)) row.sent = true;
  }
}

function rows(count: number, locale = 'vi'): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `row-${locale}-${index}`,
    email: `learner-${locale}-${index}@example.com`,
    locale,
  }));
}

let clock = 0;
const sent: OutboundCommunicationEmail[] = [];

function deps(list: FakeList, failFor: (to: string) => boolean = () => false) {
  return {
    list,
    starterHref: vi.fn(async (locale: string): Promise<string | null> =>
      locale === 'en' ? '/quiz/en-starter?mode=quick' : '/quiz/vi-starter',
    ),
    send: vi.fn(async (mail: OutboundCommunicationEmail) => {
      clock += 100;
      if (failFor(mail.to)) throw new Error(`Resend email failed for ${mail.to}`);
      sent.push(mail);
      return `resend-${sent.length}`;
    }),
    from: 'Rinkuzu <support@example.com>',
    siteUrl: 'https://www.rinkuzu.test',
    now: () => clock,
    sleep: vi.fn(async (ms: number) => {
      clock += ms;
    }),
  };
}

const options = { campaign: CAMPAIGN, dryRun: false, budgetMs: 50_000, sendIntervalMs: 0 };

beforeEach(() => {
  clock = 0;
  sent.length = 0;
  logs.lines.length = 0;
});

describe('runOutageNotifySend', () => {
  it('dry run sends nothing and returns the pending count', async () => {
    const list = new FakeList(rows(3));
    const d = deps(list);

    const result = await runOutageNotifySend(d, { ...options, dryRun: true });

    expect(result).toEqual({ campaign: CAMPAIGN, dryRun: true, sent: 0, failed: 0, remaining: 3 });
    expect(d.send).not.toHaveBeenCalled();
    expect(list.pendingCalls).toBe(0);
    expect(list.markSentCalls).toEqual([]);
  });

  it('sends exactly one email per pending row in its locale and marks them sent', async () => {
    const list = new FakeList([...rows(2, 'vi'), ...rows(1, 'en')]);
    const d = deps(list);

    const result = await runOutageNotifySend(d, options);

    expect(result).toEqual({ campaign: CAMPAIGN, dryRun: false, sent: 3, failed: 0, remaining: 0 });
    expect(sent.map((mail) => mail.to).sort()).toEqual(
      ['learner-en-0@example.com', 'learner-vi-0@example.com', 'learner-vi-1@example.com'].sort(),
    );
    const en = sent.find((mail) => mail.to === 'learner-en-0@example.com');
    expect(en?.subject).toBe('subject-en');
    const enUrl = new URL(en?.text ?? '');
    expect(enUrl.pathname).toBe('/en/quiz/en-starter');
    expect(enUrl.searchParams.get('mode')).toBe('quick');
    expect(enUrl.searchParams.get('utm_source')).toBe('outage_notify');
    expect(enUrl.searchParams.get('utm_medium')).toBe('email');
    expect(enUrl.searchParams.get('utm_campaign')).toBe(CAMPAIGN);
    const vi_ = sent.find((mail) => mail.to === 'learner-vi-0@example.com');
    expect(vi_?.subject).toBe('subject-vi');
    expect(new URL(vi_?.text ?? '').pathname).toBe('/vi/quiz/vi-starter');
    expect(en?.idempotencyKey).toBe(`outage-notify:${CAMPAIGN}:row-en-0`);
    expect(list.markSentCalls.flat().sort()).toEqual(['row-en-0', 'row-vi-0', 'row-vi-1']);
    // One starter lookup per locale, not per recipient.
    expect(d.starterHref).toHaveBeenCalledTimes(2);
  });

  it('marks only accepted sends; a failed send stays pending and is counted', async () => {
    const list = new FakeList(rows(3));
    const d = deps(list, (to) => to === 'learner-vi-1@example.com');

    const result = await runOutageNotifySend(d, options);

    expect(result).toMatchObject({ sent: 2, failed: 1, remaining: 1 });
    expect(list.markSentCalls.flat()).toEqual(['row-vi-0', 'row-vi-2']);
    // The failed row is tried once per run, not on every round.
    expect(d.send).toHaveBeenCalledTimes(3);
  });

  it('a second call after a full run sends nothing', async () => {
    const list = new FakeList(rows(120));
    await runOutageNotifySend(deps(list), options);
    expect(sent).toHaveLength(120);

    const again = deps(list);
    const result = await runOutageNotifySend(again, options);

    expect(result).toMatchObject({ sent: 0, failed: 0, remaining: 0 });
    expect(again.send).not.toHaveBeenCalled();
  });

  it('stops at the time budget and leaves the rest for a re-run', async () => {
    const list = new FakeList(rows(10));
    const result = await runOutageNotifySend(deps(list), { ...options, budgetMs: 450 });

    expect(result).toMatchObject({ sent: 5, failed: 0, remaining: 5 });
    const rerun = await runOutageNotifySend(deps(list), options);
    expect(rerun).toMatchObject({ sent: 5, remaining: 0 });
    expect(new Set(sent.map((mail) => mail.to)).size).toBe(10);
  });

  it('stops a round with no accepted send instead of retrying a broken provider', async () => {
    const list = new FakeList(rows(80));
    const d = deps(list, () => true);

    const result = await runOutageNotifySend(d, options);

    expect(result).toMatchObject({ sent: 0, failed: 50, remaining: 80 });
    expect(list.markSentCalls).toEqual([]);
  });

  it('paces sends by the interval', async () => {
    const list = new FakeList(rows(3));
    const d = deps(list);

    await runOutageNotifySend(d, { ...options, sendIntervalMs: 550 });

    expect(d.sleep).toHaveBeenCalledTimes(2);
    expect(d.sleep).toHaveBeenCalledWith(450);
  });

  it('never logs or returns an address', async () => {
    const list = new FakeList(rows(2));
    const result = await runOutageNotifySend(
      deps(list, (to) => to.endsWith('1@example.com')),
      options,
    );

    expect(JSON.stringify(result)).not.toContain('@');
    expect(JSON.stringify(logs.lines)).not.toContain('@example.com');
  });
});

describe('outageNotifyCampaign', () => {
  it('defaults and rejects malformed values', () => {
    expect(outageNotifyCampaign(undefined)).toBe('2026-11-vercel');
    expect(outageNotifyCampaign(' 2027-01-x ')).toBe('2027-01-x');
    expect(outageNotifyCampaign('bad campaign/../')).toBe('2026-11-vercel');
  });
});

describe('the button link', () => {
  it('falls back to /try when the locale has no starter', async () => {
    const d = deps(new FakeList(rows(1)));
    d.starterHref.mockResolvedValue(null);

    await runOutageNotifySend(d, options);

    const url = new URL(sent[0]?.text ?? '');
    expect(url.pathname).toBe('/vi/try');
    expect(url.searchParams.get('utm_campaign')).toBe(CAMPAIGN);
  });
});
