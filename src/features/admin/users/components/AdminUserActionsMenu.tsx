'use client';

import { useCallback, useId, useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent, ReactNode } from 'react';
import { HiOutlineChevronDown, HiOutlinePlusCircle } from 'react-icons/hi';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { ButtonBase } from '@/components/ui/ButtonBase';
import { useDropdownOutside } from '@/components/ui/hooks/use-dropdown-outside';
import type { AdminUserViewModel } from '@/features/admin/users/types/admin-users-view-model';
import { ACCOUNT_DISABLE_DISABLED } from '@/shared/constants/account-disable';

/**
 * One "Actions" disclosure per user on /admin/users (RIN-1021). The row used to
 * carry up to seven buttons, which pushed the table to ~2000 px and hid every
 * action behind a horizontal scroll at 1280 and 1440. The panel is a plain list
 * of links and buttons: Tab walks it in order, Esc closes it and returns focus
 * to the trigger, and leaving it with Tab or a click outside closes it too.
 */

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

export interface AdminUserActionCallbacks {
  onOpenCreditModal: (user: AdminUserViewModel) => void;
  onOpenSubscriptionModal: (user: AdminUserViewModel) => void;
  onOpenRoleModal: (user: AdminUserViewModel) => void;
  onOpenStatusModal: (user: AdminUserViewModel) => void;
  onOpenTestAccountModal: (user: AdminUserViewModel) => void;
}

interface AdminUserActionsMenuProps extends AdminUserActionCallbacks {
  user: AdminUserViewModel;
  isSelf: boolean;
  busy: boolean;
  describedBy: string;
  t: TranslateFn;
}

interface MenuItemProps {
  children: ReactNode;
  disabled: boolean;
  tone?: string;
  onSelect: () => void;
}

const ITEM_CLASS =
  'flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm font-medium transition-colors hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-700 disabled:cursor-not-allowed disabled:opacity-50';

function MenuItem({ children, disabled, tone = 'text-neutral-800', onSelect }: MenuItemProps) {
  return (
    <ButtonBase className={`${ITEM_CLASS} ${tone}`} disabled={disabled} onClick={onSelect}>
      {children}
    </ButtonBase>
  );
}

export function AdminUserActionsMenu({
  user,
  isSelf,
  busy,
  describedBy,
  t,
  onOpenCreditModal,
  onOpenSubscriptionModal,
  onOpenRoleModal,
  onOpenStatusModal,
  onOpenTestAccountModal,
}: AdminUserActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const closeMenu = useCallback(() => setOpen(false), []);
  useDropdownOutside(containerRef, open, closeMenu);

  const isDisabled = user.disable === ACCOUNT_DISABLE_DISABLED;

  const select = (action: (target: AdminUserViewModel) => void) => () => {
    setOpen(false);
    action(user);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !open) return;
    event.stopPropagation();
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && containerRef.current?.contains(next)) return;
    if (next) setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown} onBlur={handleBlur}>
      <Button
        ref={triggerRef}
        variant="outline"
        size="sm"
        className="min-h-11 gap-1 px-3"
        aria-expanded={open}
        aria-controls={panelId}
        aria-describedby={describedBy}
        onClick={() => setOpen((previous) => !previous)}
      >
        {t('actions')}
        <HiOutlineChevronDown
          className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </Button>
      {open ? (
        <div
          id={panelId}
          className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-lg border border-line bg-surface py-1 text-left shadow-lg"
        >
          <Link
            href={`/admin/support?userId=${encodeURIComponent(user.id)}`}
            className={`${ITEM_CLASS} text-neutral-800`}
          >
            {t('userActionSupport')}
          </Link>
          <Link
            href={`/admin/feedback?userId=${encodeURIComponent(user.id)}`}
            className={`${ITEM_CLASS} text-neutral-800`}
          >
            {t('userActionRequestFeedback')}
          </Link>
          <MenuItem disabled={busy} tone="text-amber-700" onSelect={select(onOpenCreditModal)}>
            <HiOutlinePlusCircle className="size-4" aria-hidden="true" />
            {t('addCredit')}
          </MenuItem>
          <MenuItem disabled={busy} onSelect={select(onOpenTestAccountModal)}>
            {user.isTestAccount ? t('unmarkTestAccount') : t('markTestAccount')}
          </MenuItem>
          {isSelf ? null : (
            <>
              {isDisabled ? null : (
                <MenuItem
                  disabled={busy}
                  tone="text-green-600"
                  onSelect={select(onOpenSubscriptionModal)}
                >
                  {t('addSubscription')}
                </MenuItem>
              )}
              <MenuItem disabled={busy} onSelect={select(onOpenRoleModal)}>
                {user.role === 'admin' ? t('makeUser') : t('makeAdmin')}
              </MenuItem>
              <MenuItem
                disabled={busy}
                tone={isDisabled ? 'text-green-700' : 'text-red-600'}
                onSelect={select(onOpenStatusModal)}
              >
                {isDisabled ? t('restore') : t('disable')}
              </MenuItem>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
