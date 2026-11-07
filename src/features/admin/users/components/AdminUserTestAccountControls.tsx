'use client';

import { Badge } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import type { AdminUserViewModel } from '@/features/admin/users/types/admin-users-view-model';

/**
 * The admin-set test-account flag on /admin/users (RIN-668): a flagged account
 * is left out of every activation series in /api/admin/stats/activation.
 */

type TranslateFn = (key: string, values?: Record<string, string | number | Date>) => string;

interface TestAccountUserProps {
  user: AdminUserViewModel;
  t: TranslateFn;
}

interface TestAccountModalProps {
  isOpen: boolean;
  selectedUser: AdminUserViewModel | null;
  actionLoading: string | null;
  onClose: () => void;
  onConfirm: () => void;
  t: TranslateFn;
}

export function TestAccountBadge({ user, t }: TestAccountUserProps) {
  if (!user.isTestAccount) return null;
  return (
    <Badge variant="warning" className="mt-1 w-fit">
      {t('testAccountBadge')}
    </Badge>
  );
}

export function TestAccountModal({
  isOpen,
  selectedUser,
  actionLoading,
  onClose,
  onConfirm,
  t,
}: TestAccountModalProps) {
  if (!selectedUser) return null;

  const clearing = selectedUser.isTestAccount;

  return (
    <ConfirmModal
      isOpen={isOpen}
      title={clearing ? t('unmarkTestAccountTitle') : t('markTestAccountTitle')}
      message={
        clearing
          ? t('unmarkTestAccountConfirm', { email: selectedUser.email })
          : t('markTestAccountConfirm', { email: selectedUser.email })
      }
      cancelText={t('cancel')}
      confirmText={clearing ? t('unmarkTestAccount') : t('markTestAccount')}
      confirmVariant="default"
      onCancel={onClose}
      onConfirm={onConfirm}
      isLoading={actionLoading === selectedUser.id}
    />
  );
}
