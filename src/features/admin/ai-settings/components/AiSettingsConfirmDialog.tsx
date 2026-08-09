'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

type AiSettingsConfirmDialogProps = {
  busy?: boolean;
  cancelLabel: string;
  confirmLabel: string;
  description: string;
  open: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function AiSettingsConfirmDialog({
  busy = false,
  cancelLabel,
  confirmLabel,
  description,
  open,
  title,
  onCancel,
  onConfirm,
}: AiSettingsConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="ai-settings-confirm-title"
        aria-describedby="ai-settings-confirm-description"
        className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-error-surface text-error">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="ai-settings-confirm-title" className="text-base font-semibold text-ink">
              {title}
            </h2>
            <p
              id="ai-settings-confirm-description"
              className="mt-1 text-sm leading-relaxed text-ink-muted"
            >
              {description}
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button ref={confirmRef} variant="destructive" loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}
