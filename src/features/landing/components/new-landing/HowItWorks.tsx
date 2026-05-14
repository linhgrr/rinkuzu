import { useTranslations } from 'next-intl';
import { UserPlus, Upload, Target } from 'lucide-react';

export function HowItWorks() {
  const t = useTranslations('landing.howItWorks');

  const steps = [
    { key: 'step1', Icon: UserPlus },
    { key: 'step2', Icon: Upload },
    { key: 'step3', Icon: Target },
  ];

  return (
    <section className="bg-black py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-semibold text-white mb-4">{t('title')}</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((step) => {
            const Icon = step.Icon;
            return (
              <div
                key={step.key}
                className="text-center rounded-2xl border border-white/10 bg-white/5 p-8"
              >
                <div className="size-16 rounded-full bg-green-500/10 border border-brand-trust/20 flex items-center justify-center mx-auto mb-6">
                  <Icon className="size-7 text-green-400" aria-hidden="true" />
                </div>
                <h3 className="text-white font-semibold text-xl mb-3">{t(`${step.key}.title`)}</h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  {t(`${step.key}.description`)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
