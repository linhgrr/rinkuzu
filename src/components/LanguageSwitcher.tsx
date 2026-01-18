'use client';

import { useTranslation } from '@/lib/i18n';
import clsx from 'clsx';

interface LanguageSwitcherProps {
  className?: string;
}

export default function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useTranslation();

  return (
    <div
      className={clsx(
        'flex items-center gap-1 rounded-full border border-gray-200 bg-white/80 p-1 text-[11px] font-medium text-[#1d1d1f] shadow-sm',
        className
      )}
      aria-label={t('language.switcher')}
    >
      <button
        type="button"
        onClick={() => setLocale('en')}
        aria-pressed={locale === 'en'}
        className={clsx(
          'px-2 py-1 rounded-full transition-colors',
          locale === 'en' ? 'bg-[#0071e3] text-white' : 'hover:bg-gray-100'
        )}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale('vi')}
        aria-pressed={locale === 'vi'}
        className={clsx(
          'px-2 py-1 rounded-full transition-colors',
          locale === 'vi' ? 'bg-[#0071e3] text-white' : 'hover:bg-gray-100'
        )}
      >
        VI
      </button>
    </div>
  );
}
