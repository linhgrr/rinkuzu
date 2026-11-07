'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { HiOutlineExclamationCircle, HiOutlineInformationCircle } from 'react-icons/hi';
import { Badge } from '@/components/ui/Card';
import type { SupportTicketViewModel } from '../types/communication-view-model';

type SupportStatus = SupportTicketViewModel['status'];

const STATUS_VARIANT = {
  open: 'info',
  waiting_for_admin: 'info',
  waiting_for_user: 'warning',
  resolved: 'success',
  closed: 'default',
} as const satisfies Record<SupportStatus, 'info' | 'warning' | 'success' | 'default'>;

/** Ticket status as the shared badge, the same in the list and the thread header (RIN-1018). */
export function SupportStatusBadge({ status }: { status: SupportStatus }): ReactNode {
  const t = useTranslations('communications.support');
  return (
    <Badge variant={STATUS_VARIANT[status]} data-status={status} className="shrink-0">
      {t(`statuses.${status}`)}
    </Badge>
  );
}

/** Inline message under a field, linked to it through `aria-describedby` (auth form pattern). */
export function SupportFieldMessage({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 flex items-center font-home text-xs text-error">
      <HiOutlineExclamationCircle className="mr-1 size-4 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

/** A failed send or action. `message` is always localised copy, never server text. */
export function SupportFormAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
    >
      <HiOutlineExclamationCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <p className="font-medium">{message}</p>
    </div>
  );
}

/** Explains what a resolved or closed ticket allows next. */
export function SupportTicketNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-line bg-surface-warm p-3 text-sm text-ink">
      <HiOutlineInformationCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-3">{children}</div>
    </div>
  );
}
