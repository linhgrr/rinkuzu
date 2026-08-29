import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { revealMock, replayMock } = vi.hoisted(() => ({
  revealMock: vi.fn(),
  replayMock: vi.fn(),
}));

// The shared UI states reach for translations; the panel's own copy is plain
// English, so keys are enough to assert on here.
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/features/admin/billing/api/admin-billing-api', () => ({
  revealWebhookPayload: revealMock,
  replayWebhook: replayMock,
  fetchAdminWebhookDiagnostics: vi.fn(),
}));

import { WebhookDiagnosticsPanel } from './WebhookDiagnosticsPanel';
import type { UseWebhookDiagnostics } from '@/features/admin/billing/hooks/useWebhookDiagnostics';
import type { AdminWebhookDiagnosticViewModel } from '@/features/admin/billing/types/admin-billing-view-model';

function row(
  overrides: Partial<AdminWebhookDiagnosticViewModel> = {},
): AdminWebhookDiagnosticViewModel {
  return {
    id: 'inbox-1',
    verificationClass: 'unsupported_schema',
    status: 'dead_letter',
    payloadHashShort: 'a1b2c3d4',
    sizeLabel: '1.2 KB',
    retainedPayloadStored: true,
    retainedPayloadKeyVersion: 'v1',
    attemptCount: 3,
    createdAtLabel: '28 Aug 2026',
    replayable: true,
    ...overrides,
  };
}

function diagnostics(overrides: Partial<UseWebhookDiagnostics> = {}): UseWebhookDiagnostics {
  return {
    webhooks: [row()],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    verificationClass: '',
    loading: false,
    error: '',
    setVerificationClass: vi.fn(),
    setPage: vi.fn(),
    reload: vi.fn(),
    ...overrides,
  };
}

/**
 * The webhook door's record used to be reachable only from a database console,
 * which is the difference between "a checksum key stopped matching an hour ago"
 * and "the provider seems to have gone quiet". This panel is that record, and
 * the two things worth pinning about it are that a body is never on screen
 * until someone asks for it by row, and that neither action is offered on a row
 * that is not waiting on it.
 */
describe('the webhook diagnostics panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows what arrived without showing any retained body', () => {
    render(<WebhookDiagnosticsPanel diagnostics={diagnostics()} />);

    expect(screen.getByText('a1b2c3d4')).toBeInTheDocument();
    expect(screen.getByText(/1\.2 KB/)).toBeInTheDocument();
    // Nothing decrypted on the way past: a listing that opened every retained
    // body would be a bulk disclosure and would leave "who has seen this?"
    // unanswerable.
    expect(revealMock).not.toHaveBeenCalled();
    expect(document.querySelector('pre')).toBeNull();
  });

  it('reveals one row only when an operator asks for it', async () => {
    revealMock.mockResolvedValue({
      inboxRef: 'inbox-1',
      payload: '{"data":{"orderCode":4242}}',
      retained: true,
      unreadable: false,
    });
    render(<WebhookDiagnosticsPanel diagnostics={diagnostics()} />);

    await userEvent.click(screen.getByRole('button', { name: /reveal retained body/i }));

    await waitFor(() => expect(revealMock).toHaveBeenCalledWith('inbox-1'));
    expect(await screen.findByText(/"orderCode":4242/)).toBeInTheDocument();
  });

  it('says so plainly when the sealing key is no longer configured', async () => {
    // An ordinary outcome after a payload-key rotation, not an error.
    revealMock.mockResolvedValue({
      inboxRef: 'inbox-1',
      payload: null,
      retained: true,
      unreadable: true,
    });
    render(<WebhookDiagnosticsPanel diagnostics={diagnostics()} />);

    await userEvent.click(screen.getByRole('button', { name: /reveal retained body/i }));

    expect(await screen.findByText(/no configured key can open it/i)).toBeInTheDocument();
    expect(document.querySelector('pre')).toBeNull();
  });

  it('offers no reveal on a row that retained nothing', () => {
    render(
      <WebhookDiagnosticsPanel
        diagnostics={diagnostics({
          webhooks: [row({ retainedPayloadStored: false, verificationClass: 'unauthenticated' })],
        })}
      />,
    );

    expect(screen.queryByRole('button', { name: /reveal retained body/i })).toBeNull();
  });

  it('offers no replay on a row that is not waiting on one', () => {
    render(
      <WebhookDiagnosticsPanel
        diagnostics={diagnostics({
          webhooks: [row({ replayable: false, status: 'processed' })],
        })}
      />,
    );

    expect(screen.queryByRole('button', { name: /^replay$/i })).toBeNull();
  });

  it('replays a stalled row and refreshes the list it changed', async () => {
    replayMock.mockResolvedValue({ inboxRef: 'inbox-1', outcome: 'requeued', duplicate: false });
    const view = diagnostics();
    render(<WebhookDiagnosticsPanel diagnostics={view} />);

    await userEvent.click(screen.getByRole('button', { name: /^replay$/i }));

    await waitFor(() => expect(replayMock).toHaveBeenCalledWith('inbox-1'));
    expect(view.reload).toHaveBeenCalled();
    expect(await screen.findByText(/queued for the next drain tick/i)).toBeInTheDocument();
  });

  it('reports a reclassified replay that landed on money already recorded', async () => {
    replayMock.mockResolvedValue({
      inboxRef: 'inbox-1',
      outcome: 'reclassified',
      duplicate: true,
    });
    render(<WebhookDiagnosticsPanel diagnostics={diagnostics()} />);

    await userEvent.click(screen.getByRole('button', { name: /^replay$/i }));

    expect(await screen.findByText(/already known/i)).toBeInTheDocument();
  });

  it('surfaces a refused action instead of failing silently', async () => {
    replayMock.mockRejectedValue(new Error('A webhook in "processed" is not waiting on a replay'));
    render(<WebhookDiagnosticsPanel diagnostics={diagnostics()} />);

    await userEvent.click(screen.getByRole('button', { name: /^replay$/i }));

    expect(await screen.findByText(/not waiting on a replay/i)).toBeInTheDocument();
  });

  it('reports a failed load rather than an empty list', () => {
    render(
      <WebhookDiagnosticsPanel
        diagnostics={diagnostics({ webhooks: [], error: 'Failed to load webhook diagnostics' })}
      />,
    );

    // An empty list and a broken query look identical to an operator, and that
    // is exactly the confusion this whole surface exists to remove.
    expect(screen.getByText(/failed to load webhook diagnostics/i)).toBeInTheDocument();
  });

  it('filters by verification class', async () => {
    const view = diagnostics();
    render(<WebhookDiagnosticsPanel diagnostics={view} />);

    await userEvent.click(screen.getByRole('button', { name: 'unauthenticated' }));

    expect(view.setVerificationClass).toHaveBeenCalledWith('unauthenticated');
  });
});
