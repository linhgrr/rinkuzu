'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { isPremiumLimitError } from '@/features/subscription/lib/limit-error';
import { subscribeToApiErrors } from '@/lib/api/error-events';

const DISMISS_KEY = 'rinkuzu-upgrade-prompt-dismissed';

function isDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(DISMISS_KEY) === '1';
}

export function UpgradePromptProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('premium');
  const { push } = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const goToBilling = useCallback(() => {
    setModalOpen(false);
    push('/subscription');
  }, [push]);

  const showToast = useCallback(() => {
    toast.info(t('limitReachedTitle'), {
      description: t('rateLimitMessage'),
      action: { label: t('upgradeCta'), onClick: goToBilling },
    });
  }, [goToBilling, t]);

  const promptUpgrade = useCallback(() => {
    if (isDismissed()) {
      showToast();
      return;
    }
    setModalOpen(true);
  }, [showToast]);

  useEffect(
    () =>
      subscribeToApiErrors((error) => {
        if (isPremiumLimitError(error)) promptUpgrade();
      }),
    [promptUpgrade],
  );

  const closeModal = () => {
    if (dontShowAgain && typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_KEY, '1');
    }
    setModalOpen(false);
  };

  return (
    <>
      {children}
      <Modal isOpen={modalOpen} onClose={closeModal} title={t('limitReachedTitle')}>
        <div className="p-6">
          <p className="mb-6 text-neutral-600">{t('rateLimitMessage')}</p>
          <div className="mb-6 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 p-4">
            <h4 className="mb-2 font-medium text-neutral-900">{t('benefits')}</h4>
            <ul className="space-y-1 text-sm text-neutral-700">
              <li>{t('benefitUnlimitedAttempts')}</li>
              <li>{t('benefitPrivateQuizzes')}</li>
              <li>{t('benefitDetailedStats')}</li>
              <li>{t('benefitPrioritySupport')}</li>
            </ul>
          </div>
          <label className="mb-4 flex items-center gap-x-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(event) => setDontShowAgain(event.target.checked)}
            />
            {t('dontShowAgain')}
          </label>
          <div className="flex flex-col gap-y-3">
            <Button onClick={goToBilling} className="w-full">
              {t('upgradeToPremium')}
            </Button>
            <Button onClick={closeModal} variant="ghost" className="w-full">
              {t('dismiss')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
