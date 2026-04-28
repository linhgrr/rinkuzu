'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Navbar, { GlowPillButton } from './Navbar';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260217_030345_246c0224-10a4-422c-b324-070b7c0eceda.mp4';

const HeroSection = ({ isAuthenticated = false }: { isAuthenticated?: boolean }) => {
  const t = useTranslations('landing.hero');
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) return;

    const timer = window.setTimeout(() => {
      setShouldLoadVideo(true);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-black font-sans">
      {/* Background video */}
      {shouldLoadVideo ? (
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          aria-hidden="true"
          tabIndex={-1}
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={VIDEO_URL} type="video/mp4" />
        </video>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d1117] via-[#111827] to-black" />
      )}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar isAuthenticated={isAuthenticated} />

        {/* Hero content */}
        <div className="flex-1 flex flex-col items-center justify-start pt-[120px] md:pt-[280px] pb-[102px] px-6">
          <div className="flex flex-col items-center gap-[40px]">
            {/* Badge */}
            <div
              className="flex items-center gap-2 rounded-[20px] px-4 py-2 text-[13px] font-medium"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              <span className="w-[4px] h-[4px] rounded-full bg-white" />
              <span className="text-white/60">{t('poweredBy')}</span>
              <span className="text-white">{t('geminiAi')}</span>
            </div>

            {/* Heading */}
            <h1
              className="max-w-[700px] text-center text-[36px] md:text-[56px] font-medium leading-[1.28]"
              style={{
                background: 'linear-gradient(144.5deg, #ffffff 28%, rgba(0,0,0,0) 115%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {t('headline')}
            </h1>

            {/* Subtitle */}
            <p className="max-w-[680px] text-center text-[15px] font-normal text-white/70 -mt-[16px]">
              {t('subtitle')}
            </p>

            {/* CTA */}
            <GlowPillButton label={t('ctaStartLearning')} variant="light" href="/register" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
