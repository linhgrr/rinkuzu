'use client';

import { useTranslations } from 'next-intl';
import { UserPlus, Upload, Target } from 'lucide-react';
import { Reveal, RevealStagger, RevealItem } from './motion-primitives';

export function HowItWorks() {
  const t = useTranslations('landing.howItWorks');

  const steps = [
    { key: 'step1', Icon: UserPlus },
    { key: 'step2', Icon: Upload },
    { key: 'step3', Icon: Target },
  ];

  return (
    <section className="bg-[#07121a] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="mb-16 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
            {t('title')}
          </h2>
        </Reveal>

        <div className="relative mx-auto max-w-5xl">
          {/* connecting line (desktop) */}
          <div
            aria-hidden="true"
            className="absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-green-500/30 to-transparent md:block"
          />
          <RevealStagger className="grid gap-10 md:grid-cols-3 md:gap-8">
            {steps.map((step, i) => {
              const Icon = step.Icon;
              return (
                <RevealItem key={step.key} className="relative text-center">
                  <div className="relative mx-auto mb-6 flex size-16 items-center justify-center rounded-full border border-green-500/20 bg-[#07121a] shadow-[0_0_40px_rgba(52,211,153,0.15)]">
                    <Icon className="size-7 text-green-400" aria-hidden="true" />
                    <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-[#07121a]">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="mb-3 text-xl font-semibold text-white">
                    {t(`${step.key}.title`)}
                  </h3>
                  <p className="mx-auto max-w-xs text-sm leading-relaxed text-white/60">
                    {t(`${step.key}.description`)}
                  </p>
                </RevealItem>
              );
            })}
          </RevealStagger>
        </div>
      </div>
    </section>
  );
}
