import { useTranslations } from 'next-intl';
import type { QuizVisibilityLabels } from '@/features/quiz/components/QuizMetaForm';

/** Copy for the owner's Private / Public control on the quiz editors (RIN-1275). */
export function useQuizVisibilityLabels(): QuizVisibilityLabels {
  const t = useTranslations('create');
  return {
    label: t('visibilityLabel'),
    private: t('visibilityPrivate'),
    public: t('visibilityPublic'),
    privateHelper: t('visibilityPrivateHelper'),
    publicHelper: t('visibilityPublicHelper'),
    premiumHelper: t('visibilityPremiumHelper'),
  };
}
