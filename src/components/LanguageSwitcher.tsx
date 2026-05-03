'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { locales, localeLabels, localeFlags, type Locale } from '@/i18n/config';

interface LanguageSwitcherProps {
  className?: string;
  variant?: 'dropdown' | 'inline';
}

export const LanguageSwitcher = memo(function LanguageSwitcher({
  className = '',
  variant = 'dropdown',
}: LanguageSwitcherProps) {
  const locale = useLocale() as Locale;
  const tCommon = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }

    return undefined;
  }, [isOpen]);

  const handleLocaleChange = useCallback(
    (newLocale: Locale) => {
      router.push(pathname, { locale: newLocale });
      setIsOpen(false);
    },
    [pathname, router],
  );

  const toggleDropdown = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {locales.map((loc) => (
          <button
            key={loc}
            onClick={() => handleLocaleChange(loc)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              locale === loc ? 'bg-brand-trust text-white' : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            {localeFlags[loc]} {localeLabels[loc]}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-base font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors"
        aria-label={tCommon('changeLanguage')}
      >
        <span className="text-base">{localeFlags[locale]}</span>
        <span className="hidden sm:inline">{localeLabels[locale]}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
            aria-label={tCommon('close')}
          />
          <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-[var(--shadow-md)] border border-neutral-100 overflow-hidden z-20 animate-scaleIn origin-top-right">
            {locales.map((loc) => (
              <button
                key={loc}
                onClick={() => handleLocaleChange(loc)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                  locale === loc
                    ? 'bg-green-50 text-brand-trust font-medium'
                    : 'text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                <span className="text-base">{localeFlags[loc]}</span>
                <span>{localeLabels[loc]}</span>
                {locale === loc && (
                  <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
});

export default LanguageSwitcher;
