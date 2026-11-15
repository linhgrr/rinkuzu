import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/communication/outage-notify', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/communication/outage-notify')>()),
  runOutageNotifySend: mocks.run,
}));
vi.mock('@/lib/communication/outage-notify-upstream', () => ({
  outageNotifyApi: { name: 'api' },
  OutageNotifyUpstreamError: class OutageNotifyUpstreamError extends Error {},
}));
vi.mock('@/lib/communication/resend', () => ({
  communicationEnvironment: () => 'Rinkuzu <support@example.com>',
  sendCommunicationEmail: vi.fn(),
}));
vi.mock('@/lib/communication/internal', () => ({ siteUrl: () => 'https://www.rinkuzu.test' }));
vi.mock('@/lib/dashboard-factory', () => ({ getStarterQuizHref: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: mocks.logError } }));

const { POST } = await import('./route');
const { OutageNotifyUpstreamError } = await import('@/lib/communication/outage-notify-upstream');

const SECRET = 'fake-cron-secret-for-tests-0123456789';

function call(query = '', authorization: string | null = `Bearer ${SECRET}`): Promise<Response> {
  return POST(
    new NextRequest(`https://www.rinkuzu.test/api/internal/outage-notify/send${query}`, {
      method: 'POST',
      headers: authorization ? { authorization } : {},
    }),
  );
}

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', SECRET);
  vi.stubEnv('OUTAGE_NOTIFY_CAMPAIGN', '');
  mocks.run.mockReset();
  mocks.logError.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/internal/outage-notify/send', () => {
  it.each([
    ['no header', null],
    ['a wrong secret', 'Bearer not-the-secret'],
  ])('answers 401 with %s and sends nothing', async (_label, authorization) => {
    const response = await call('', authorization);

    expect(response.status).toBe(401);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it('answers 401 when CRON_SECRET is unset', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const response = await call('', 'Bearer ');

    expect(response.status).toBe(401);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it('passes dryRun and the default campaign, and answers counts only', async () => {
    mocks.run.mockResolvedValue({
      campaign: '2026-11-vercel',
      dryRun: true,
      sent: 0,
      failed: 0,
      remaining: 7,
    });

    const response = await call('?dryRun=1');

    expect(response.status).toBe(200);
    expect(mocks.run).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'Rinkuzu <support@example.com>' }),
      expect.objectContaining({ campaign: '2026-11-vercel', dryRun: true, budgetMs: 50_000 }),
    );
    const body = (await response.json()) as { data: Record<string, unknown> };
    expect(body.data).toEqual({
      campaign: '2026-11-vercel',
      dryRun: true,
      sent: 0,
      failed: 0,
      remaining: 7,
    });
  });

  it('reads the campaign from OUTAGE_NOTIFY_CAMPAIGN and sends for real without dryRun', async () => {
    vi.stubEnv('OUTAGE_NOTIFY_CAMPAIGN', '2027-01-test');
    mocks.run.mockResolvedValue({ sent: 1, failed: 0, remaining: 0 });

    await call();

    expect(mocks.run).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ campaign: '2027-01-test', dryRun: false }),
    );
  });

  it('treats any dryRun value as a dry run', async () => {
    mocks.run.mockResolvedValue({ sent: 0, failed: 0, remaining: 0 });

    await call('?dryRun=true');

    expect(mocks.run).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ dryRun: true }),
    );
  });

  it('answers 502 without detail when the API list is unavailable', async () => {
    mocks.run.mockRejectedValue(new OutageNotifyUpstreamError('pending', 'status 503'));

    const response = await call();

    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('@');
  });
});
