import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { recordExternalAdjustment } from '@/features/admin/billing/api/admin-billing-api';
import {
  MONEY_ADJUSTMENT_TYPES,
  MONEY_ALLOCATIONS,
  type MoneyAdjustmentType,
  type MoneyAllocation,
} from '@/services/billing/domain/settlement-math';
import { useAdminApiErrorMessage } from '@/lib/api/use-api-error';

/**
 * Recording money that moved outside the provider.
 *
 * The reference must be the provider's own, because the ledger dedupes on it —
 * and recording the same reference with different money is refused rather than
 * quietly accepted, so a mistyped amount comes back as a conflict here instead
 * of as a second refund in the accounts.
 *
 * The types come from the money algebra rather than a local list: a type the
 * ledger understands and this form does not offer is a capability that exists
 * and cannot be reached.
 */
export function RecordAdjustmentForm({
  orderId,
  onRecorded,
}: {
  orderId: string;
  onRecorded: () => void;
}) {
  const describeError = useAdminApiErrorMessage();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<MoneyAdjustmentType>('refund');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [allocation, setAllocation] = useState<MoneyAllocation>('principal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const parsedAmount = Number(amount);
  const canSubmit =
    reference.trim().length > 0 && Number.isSafeInteger(parsedAmount) && parsedAmount > 0 && !busy;

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await recordExternalAdjustment({
        orderId,
        type,
        externalReference: reference.trim(),
        amount: parsedAmount,
        allocation,
        occurredAt: new Date().toISOString(),
      });
      setReference('');
      setAmount('');
      setOpen(false);
      onRecorded();
    } catch (caught) {
      setError(describeError(caught));
    }
    setBusy(false);
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="min-h-11">
        Record refund / chargeback
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-line p-3">
      <div className="flex flex-wrap gap-2">
        {MONEY_ADJUSTMENT_TYPES.map((candidate) => (
          <Button
            key={candidate}
            variant={type === candidate ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setType(candidate)}
            className="min-h-11"
          >
            {candidate}
          </Button>
        ))}
      </div>
      <Input
        label="Provider reference (dedupe key)"
        value={reference}
        maxLength={200}
        disabled={busy}
        onChange={(event) => setReference(event.target.value)}
      />
      <Input
        label="Amount in VND (whole dong)"
        value={amount}
        inputMode="numeric"
        disabled={busy}
        onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ''))}
      />
      <div className="flex flex-wrap gap-2">
        {MONEY_ALLOCATIONS.map((candidate) => (
          <Button
            key={candidate}
            variant={allocation === candidate ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setAllocation(candidate)}
            className="min-h-11"
          >
            {candidate}
          </Button>
        ))}
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button size="sm" disabled={!canSubmit} onClick={() => void submit()} className="min-h-11">
          {busy ? 'Recording…' : 'Record'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => setOpen(false)}
          className="min-h-11"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
