'use client';

import { useTranslations } from 'next-intl';
import { GlowPillButton } from './Navbar';

export function Features() {
  const t = useTranslations('landing.features');

  return (
    <section className="bg-[#0d0d0d] py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">{t('title')}</h2>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">{t('subtitle')}</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Feature 1 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673m0 0A9 9 0 1018.668 9M9.663 17H5.667m0 0a9 9 0 0112.666-7"
                />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-lg mb-2">{t('feature1.title')}</h3>
            <p className="text-white/60 text-sm mb-4">{t('feature1.description')}</p>
            <GlowPillButton label={t('feature1.button')} variant="dark" href="/register" />
          </div>

          {/* Feature 2 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-brand-trust"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-5.182-2.645M21 12a9 9 0 01-9 9 9.863 9.863 0 01-5.182-2.645M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-lg mb-2">{t('feature2.title')}</h3>
            <p className="text-white/60 text-sm">{t('feature2.description')}</p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-orange-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-lg mb-2">{t('feature3.title')}</h3>
            <p className="text-white/60 text-sm mb-4">{t('feature3.description')}</p>
            <GlowPillButton label={t('feature3.button')} variant="dark" href="/adaptive-learning" />
          </div>

          {/* Feature 4 */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 012 2h2a2 2 0 012-2m0 0V5a2 2 0 01-2h2a2 2 0 01-2-2v5a2 2 0 01-2-2h-2a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-lg mb-2">{t('feature4.title')}</h3>
            <p className="text-white/60 text-sm">{t('feature4.description')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
