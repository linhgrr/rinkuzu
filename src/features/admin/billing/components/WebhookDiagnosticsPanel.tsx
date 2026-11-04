import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import Pagination from '@/components/ui/Pagination';
import { BillingStatusBadge } from './BillingStatusBadge';
import {
  replayWebhook,
  revealWebhookPayload,
} from '@/features/admin/billing/api/admin-billing-api';
import type { AdminWebhookDiagnosticViewModel } from '@/features/admin/billing/types/admin-billing-view-model';
import type { UseWebhookDiagnostics } from '@/features/admin/billing/hooks/useWebhookDiagnostics';
import { WEBHOOK_VERIFICATION_CLASSES } from '@/services/billing/domain/webhook-diagnostics';
import { useAdminApiErrorMessage } from '@/lib/api/use-api-error';

const CLASS_FILTERS = [
  { value: '', label: 'All' },
  ...WEBHOOK_VERIFICATION_CLASSES.map((value) => ({ value, label: value })),
];

/**
 * What actually arrived at the webhook door.
 *
 * The endpoint is unauthenticated by necessity, so every verdict it reaches is
 * written down rather than answered and forgotten — and until this panel
 * existed those rows were reachable only from a database console. That is the
 * difference between "a checksum key stopped matching an hour ago" and "the
 * provider seems to have gone quiet".
 *
 * Two actions per row, both audited server-side: reveal the one retained body,
 * and replay a delivery that stalled. Neither is available on a row that is not
 * waiting on it.
 */
export function WebhookDiagnosticsPanel({ diagnostics }: { diagnostics: UseWebhookDiagnostics }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {diagnostics.pagination.total} webhook{diagnostics.pagination.total === 1 ? '' : 's'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-2">
          {CLASS_FILTERS.map((filter) => (
            <Button
              key={filter.value || 'all'}
              variant={diagnostics.verificationClass === filter.value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => diagnostics.setVerificationClass(filter.value)}
              className="min-h-11"
            >
              {filter.label}
            </Button>
          ))}
        </div>

        {diagnostics.error ? <ErrorState message={diagnostics.error} className="mb-4" /> : null}

        {diagnostics.loading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : diagnostics.webhooks.length === 0 ? (
          <EmptyState
            title="No deliveries recorded"
            description="Nothing has reached the webhook endpoint for this filter."
          />
        ) : (
          <div className="space-y-3">
            {diagnostics.webhooks.map((row) => (
              <WebhookRow key={row.id} row={row} onChanged={diagnostics.reload} />
            ))}
          </div>
        )}

        {diagnostics.pagination.totalPages > 1 ? (
          <div className="mt-6">
            <Pagination
              currentPage={diagnostics.pagination.page}
              totalPages={diagnostics.pagination.totalPages}
              onPageChange={diagnostics.setPage}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function WebhookRow({
  row,
  onChanged,
}: {
  row: AdminWebhookDiagnosticViewModel;
  onChanged: () => void;
}) {
  const describeError = useAdminApiErrorMessage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (caught) {
      setError(describeError(caught));
    }
    setBusy(false);
  };

  const reveal = () =>
    run(async () => {
      const result = await revealWebhookPayload(row.id);
      setRevealed(result.payload);
      setNote(
        result.payload === null
          ? result.unreadable
            ? 'A body is stored but no configured key can open it.'
            : 'No body was retained for this row.'
          : '',
      );
    });

  const replay = () =>
    run(async () => {
      const result = await replayWebhook(row.id);
      setNote(
        result.outcome === 'reclassified'
          ? `Retained body parsed and recorded${result.duplicate ? ' (already known)' : ''}.`
          : 'Queued for the next drain tick.',
      );
      onChanged();
    });

  return (
    <div className="rounded-lg border border-line p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <BillingStatusBadge value={row.verificationClass} />
        <BillingStatusBadge value={row.status} />
        <span className="font-mono text-xs text-neutral-500">{row.payloadHashShort}</span>
        {row.orderCode ? (
          <span className="text-xs text-neutral-500">order {row.orderCode}</span>
        ) : null}
        <span className="text-xs text-neutral-500">
          {row.sizeLabel} · {row.attemptCount} attempt(s) · {row.createdAtLabel}
        </span>
      </div>
      {row.rejectionReason ? (
        <p className="mt-1 text-xs text-red-700">rejected: {row.rejectionReason}</p>
      ) : null}
      {row.eventCode ? (
        <p className="mt-1 text-xs text-neutral-500">
          {row.eventCode} {row.eventDesc ?? ''}
        </p>
      ) : null}
      {row.lastError ? <p className="mt-1 text-xs text-neutral-600">{row.lastError}</p> : null}

      <div className="mt-2 flex flex-wrap gap-2">
        {row.retainedPayloadStored ? (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void reveal()}
            className="min-h-11"
          >
            Reveal retained body
            {row.retainedPayloadKeyVersion ? ` (${row.retainedPayloadKeyVersion})` : ''}
          </Button>
        ) : null}
        {row.replayable ? (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void replay()}
            className="min-h-11"
          >
            Replay
          </Button>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      {note ? <p className="mt-2 text-xs text-neutral-600">{note}</p> : null}
      {revealed === null ? null : (
        <pre className="mt-2 max-h-64 overflow-auto rounded bg-neutral-900 p-3 text-xs text-neutral-100">
          {revealed}
        </pre>
      )}
    </div>
  );
}
