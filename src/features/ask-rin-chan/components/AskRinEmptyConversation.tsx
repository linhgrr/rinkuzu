'use client';

import { useAui } from '@assistant-ui/react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ButtonBase } from '@/components/ui/ButtonBase';
import styles from './AskRinPanelLayout.module.css';

const CHATBOT_ICON = '/images/chatbot_icon.png';

export function AskRinEmptyConversation() {
  const t = useTranslations('adaptiveLearning.chatbot');
  const aui = useAui();
  const suggestions = [t('suggestExplain'), t('suggestHint'), t('suggestSteps')];

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-10 text-center">
      <Image
        src={CHATBOT_ICON}
        alt={t('iconAlt')}
        width={64}
        height={64}
        className="mb-4 size-16 object-contain"
      />
      <h3 className="text-base font-semibold text-neutral-900">{t('emptyTitle')}</h3>
      <p className="mt-2 text-sm leading-6 text-neutral-500">{t('initialGreeting')}</p>
      <div className="mt-5 grid w-full gap-2">
        {suggestions.map((suggestion) => (
          <ButtonBase
            key={suggestion}
            onClick={() => aui.thread().append(suggestion)}
            className={`${styles['borderMuted']} rounded-xl border bg-white px-4 py-3 text-left text-sm text-neutral-700 transition-colors hover:border-green-300 hover:bg-green-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-trust`}
          >
            {suggestion}
          </ButtonBase>
        ))}
      </div>
    </div>
  );
}
