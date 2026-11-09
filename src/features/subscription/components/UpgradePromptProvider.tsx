'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { isPremiumLimitError } from '@/features/subscription/lib/limit-error';
import { subscribeToApiErrors } from '@/lib/api/error-events';
import { capturePaywallEvent } from '@/lib/analytics/paywall';
import {
  UpgradePaywallModal,
  type UpgradePromptKind,
} from '@/features/subscription/components/UpgradePaywallModal';

const DISMISS_KEY = 'rinkuzu-upgrade-prompt-dismissed';

// A locked Premium quiz reports `unlock_required` on load; its unlock card offers the
// credit unlock first and only an `insufficient_credits` failure opens the paywall (RIN-1014).
function isHandledInline(meta: unknown): boolean {
  return (
    typeof meta === 'object' &&
    meta !== null &&
    (meta as { reason?: unknown }).reason === 'unlock_required'
  );
}

function isDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(DISMISS_KEY) === '1';
}

export function UpgradePromptProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('premium');
  const { push } = useRouter();
  const locale = useLocale();
  const [modalOpen, setModalOpen] = useState(false);
  // Mirrors `modalOpen` for the error listener, so a second limit error while
  // the modal is up does not count as another open (RIN-1269).
  const modalOpenRef = useRef(false);
  const [promptKind, setPromptKind] = useState<UpgradePromptKind>('quota');

  useEffect(() => {
    const goToBilling = () => {
      modalOpenRef.current = false;
      setModalOpen(false);
      push('/subscription');
    };

    return subscribeToApiErrors((error) => {
      if (!isPremiumLimitError(error) || isHandledInline(error.meta)) return;

      if (isDismissed()) {
        toast.info(t('limitReachedTitle'), {
          description: t('rateLimitMessage'),
          action: { label: t('upgradeCta'), onClick: goToBilling },
        });
        return;
      }

      setPromptKind(error.code === 'quota_exceeded' ? 'quota' : 'feature');
      setModalOpen(true);
      if (modalOpenRef.current) return;
      modalOpenRef.current = true;
      capturePaywallEvent('pricing_viewed', { locale, plan: null, source: 'upgrade_modal' });
    });
  }, [locale, push, t]);

  const closeModal = (suppressFuture: boolean) => {
    if (suppressFuture && typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_KEY, '1');
    }
    modalOpenRef.current = false;
    setModalOpen(false);
  };

  return (
    <>
      {children}
      {modalOpen && <UpgradePaywallModal isOpen kind={promptKind} onClose={closeModal} />}
    </>
  );
}
