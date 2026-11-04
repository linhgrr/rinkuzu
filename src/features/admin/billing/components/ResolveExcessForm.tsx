import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { resolveOrderExcess } from '@/features/admin/billing/api/admin-billing-api';
import {
  EXCESS_RESOLUTION_COMMANDS,
  type ExcessResolutionCommand,
} from '@/services/billing/domain/excess-resolution';
import { useAdminApiErrorMessage } from '@/lib/api/use-api-error';

/**
 * Closing an overpayment.
 *
 * `unallocated` is the one billing state with no automatic exit — automation
 * can see that a customer paid too much but must never decide what happens to
 * the surplus — and this is that exit. The verdict is recorded as an
 * excess-allocated money adjustment for the full outstanding amount, so the
 * queue closes because the ledger closed it rather than because a flag was set
 * beside it.
 */
export function ResolveExcessForm({
  orderId,
  excessLabel,
  onResolved,
}: {
  orderId: string;
  excessLabel: string;
  onResolved: () => void;
}) {
  const describeError = useAdminApiErrorMessage();
  const [command, setCommand] = useState<ExcessResolutionCommand>('refund');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = reason.trim().length >= 3 && !busy;

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await resolveOrderExcess({ orderId, command, reason: reason.trim() });
      setReason('');
      onResolved();
    } catch (caught) {
      setError(describeError(caught));
    }
    setBusy(false);
  };

  return (
    <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="text-sm font-medium text-amber-900">
        Outstanding overpayment of {excessLabel} needs a decision
      </p>
      <div className="flex flex-wrap gap-2">
        {EXCESS_RESOLUTION_COMMANDS.map((candidate) => (
          <Button
            key={candidate}
            variant={command === candidate ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCommand(candidate)}
            className="min-h-11"
          >
            {candidate}
          </Button>
        ))}
      </div>
      <Input
        label="Why (kept on the order's audit trail)"
        value={reason}
        maxLength={1000}
        disabled={busy}
        onChange={(event) => setReason(event.target.value)}
      />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <Button size="sm" disabled={!canSubmit} onClick={() => void submit()} className="min-h-11">
        {busy ? 'Recording…' : 'Close overpayment'}
      </Button>
    </div>
  );
}
