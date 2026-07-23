'use client';

import { useRouter } from '@/i18n/navigation';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useTranslations } from 'next-intl';

interface PremiumRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PremiumRequiredModal({ isOpen, onClose }: PremiumRequiredModalProps) {
  const { push } = useRouter();
  const t = useTranslations('premium');
  const tCommon = useTranslations('common');

  const handleUpgrade = () => {
    onClose();
    push('/subscription');
  };

  const handleGoHome = () => {
    onClose();
    push('/');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('required')}>
      <div className="p-6">
        <div className="text-center mb-6">
          <div className="size-16 bg-gradient-to-br from-green-100 to-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="size-8 text-brand-trust"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">
            {t('subscriptionRequired')}
          </h3>
          <p className="text-neutral-600">{t('privateQuizMessage')}</p>
        </div>

        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 mb-6">
          <h4 className="font-medium text-neutral-900 mb-2">{t('benefits')}</h4>
          <ul className="space-y-2 text-sm text-neutral-700">
            <li className="flex items-center">
              <svg className="size-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {t('benefitPrivateQuizzes')}
            </li>
            <li className="flex items-center">
              <svg className="size-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {t('benefitAskRinChan')}
            </li>
            <li className="flex items-center">
              <svg className="size-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {t('benefitPdfQuiz')}
            </li>
            <li className="flex items-center">
              <svg className="size-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {t('benefitAdaptivePaths')}
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-y-3">
          <Button onClick={handleUpgrade} className="w-full">
            {t('upgradeToPremium')}
          </Button>
          <Button onClick={handleGoHome} variant="outline" className="w-full">
            {t('goToHome')}
          </Button>
          <Button onClick={onClose} variant="ghost" className="w-full">
            {tCommon('cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
