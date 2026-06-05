'use client';

import { useTranslations } from 'next-intl';
import { Zap, MessageCircle, Target, BarChart3 } from 'lucide-react';
import { GlowPillButton } from './Navbar';
import { Reveal, RevealStagger, RevealItem, SpotlightCard } from './motion-primitives';

export function Features() {
  const t = useTranslations('landing.features');

  return (
    <section className="bg-[#0d0d0d] py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="mb-16 max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
            {t('title')}
          </h2>
          <p className="mt-4 text-lg text-white/60">{t('subtitle')}</p>
        </Reveal>

        <RevealStagger className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {/* Feature 1 — wide, accent gradient */}
          <RevealItem className="md:col-span-2">
            <SpotlightCard className="group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-green-500/10 via-[#101a14] to-[#0d0d0d] p-8">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-green-500/10 blur-3xl"
              />
              <div className="relative">
                <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-green-500/15 ring-1 ring-green-500/20">
                  <Zap className="size-6 text-green-400" aria-hidden="true" />
                </div>
                <h3 className="mb-2 text-2xl font-semibold text-white">{t('feature1.title')}</h3>
                <p className="max-w-md text-[15px] leading-relaxed text-white/60">
                  {t('feature1.description')}
                </p>
              </div>
              <div className="relative mt-8">
                <GlowPillButton label={t('feature1.button')} variant="light" href="/register" />
              </div>
            </SpotlightCard>
          </RevealItem>

          {/* Feature 2 — compact */}
          <RevealItem>
            <SpotlightCard className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-8">
              <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                <MessageCircle className="size-6 text-green-400" aria-hidden="true" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-white">{t('feature2.title')}</h3>
              <p className="text-[15px] leading-relaxed text-white/60">
                {t('feature2.description')}
              </p>
            </SpotlightCard>
          </RevealItem>

          {/* Feature 4 — compact */}
          <RevealItem>
            <SpotlightCard className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-8">
              <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                <BarChart3 className="size-6 text-green-400" aria-hidden="true" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-white">{t('feature4.title')}</h3>
              <p className="text-[15px] leading-relaxed text-white/60">
                {t('feature4.description')}
              </p>
            </SpotlightCard>
          </RevealItem>

          {/* Feature 3 — wide, accent gradient */}
          <RevealItem className="md:col-span-2">
            <SpotlightCard className="group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-bl from-green-500/10 via-[#101a14] to-[#0d0d0d] p-8">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-16 -left-16 size-56 rounded-full bg-green-500/10 blur-3xl"
              />
              <div className="relative">
                <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-green-500/15 ring-1 ring-green-500/20">
                  <Target className="size-6 text-green-400" aria-hidden="true" />
                </div>
                <h3 className="mb-2 text-2xl font-semibold text-white">{t('feature3.title')}</h3>
                <p className="max-w-md text-[15px] leading-relaxed text-white/60">
                  {t('feature3.description')}
                </p>
              </div>
              <div className="relative mt-8">
                <GlowPillButton label={t('feature3.button')} variant="light" href="/adaptive" />
              </div>
            </SpotlightCard>
          </RevealItem>
        </RevealStagger>
      </div>
    </section>
  );
}
