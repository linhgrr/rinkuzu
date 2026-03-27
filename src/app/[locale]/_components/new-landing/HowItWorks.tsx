'use client';

import { useTranslations } from 'next-intl';

export function HowItWorks() {
  const t = useTranslations('landing.howItWorks');

  const steps = [
    { key: 'step1', icon: '📝' },
    { key: 'step2', icon: '📄' },
    { key: 'step3', icon: '🎯' },
  ];

  return (
    <section className="bg-black py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">{t('title')}</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((step, i) => (
            <div key={step.key} className="text-center">
              <div className="w-16 h-16 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl">{step.icon}</span>
              </div>
              <h3 className="text-white font-semibold text-xl mb-3">{t(`${step.key}.title`)}</h3>
              <p className="text-white/60 text-sm">{t(`${step.key}.description`)}</p>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 text-white/20 text-2xl">→</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
