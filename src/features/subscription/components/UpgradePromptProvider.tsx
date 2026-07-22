'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { isPremiumLimitError } from '@/features/subscription/lib/limit-error';
import { subscribeToApiErrors } from '@/lib/api/error-events';
import {
  UpgradePaywallModal,
  type UpgradePromptKind,
} from '@/features/subscription/components/UpgradePaywallModal';

const DISMISS_KEY = 'rinkuzu-upgrade-prompt-dismissed';

function isDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(DISMISS_KEY) === '1';
}

export function UpgradePromptProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('premium');
  const { push } = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [promptKind, setPromptKind] = useState<UpgradePromptKind>('quota');

  useEffect(() => {
    const goToBilling = () => {
      setModalOpen(false);
      push('/subscription');
    };

    return subscribeToApiErrors((error) => {
      if (!isPremiumLimitError(error)) return;

      if (isDismissed()) {
        toast.info(t('limitReachedTitle'), {
          description: t('rateLimitMessage'),
          action: { label: t('upgradeCta'), onClick: goToBilling },
        });
        return;
      }

      setPromptKind(error.code === 'quota_exceeded' ? 'quota' : 'feature');
      setModalOpen(true);
    });
  }, [push, t]);

  const closeModal = (suppressFuture: boolean) => {
    if (suppressFuture && typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_KEY, '1');
    }
    setModalOpen(false);
  };

  return (
    <>
      {children}
      {modalOpen && <UpgradePaywallModal isOpen kind={promptKind} onClose={closeModal} />}
    </>
  );
}
