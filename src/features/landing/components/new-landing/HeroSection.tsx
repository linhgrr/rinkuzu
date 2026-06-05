'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'framer-motion';
import Navbar, { GlowPillButton } from './Navbar';
import { Magnetic, EASE_OUT } from './motion-primitives';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260217_030345_246c0224-10a4-422c-b324-070b7c0eceda.mp4';

const HeroSection = ({ isAuthenticated = false }: { isAuthenticated?: boolean }) => {
  const t = useTranslations('landing.hero');
  const reduce = useReducedMotion();
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);

  useEffect(() => {
    if (reduce) return;
    const timer = window.setTimeout(() => setShouldLoadVideo(true), 1200);
    return () => window.clearTimeout(timer);
  }, [reduce]);

  const words = t('headline').split(' ');

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
  };
  const item = {
    hidden: { opacity: 0, y: 24, filter: 'blur(8px)' },
    show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, ease: EASE_OUT } },
  };

  return (
    <section className="relative min-h-[100dvh] w-full overflow-hidden bg-[#07121a] font-sans">
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
          className="absolute inset-0 size-full object-cover"
        >
          <source src={VIDEO_URL} type="video/mp4" />
        </video>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d1117] via-[#111827] to-black" />
      )}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-[#07121a]/50" />

      {/* Aurora glow */}
      {!reduce && (
        <>
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/4 top-1/3 size-[520px] -translate-x-1/2 rounded-full blur-[140px]"
            style={{
              background: 'radial-gradient(circle, rgba(52,211,153,0.22), transparent 70%)',
            }}
            animate={{ x: [0, 60, 0], y: [0, -40, 0], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute right-1/4 bottom-1/4 size-[460px] translate-x-1/2 rounded-full blur-[150px]"
            style={{
              background: 'radial-gradient(circle, rgba(59,130,246,0.18), transparent 70%)',
            }}
            animate={{ x: [0, -50, 0], y: [0, 30, 0], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          />
        </>
      )}

      {/* Content */}
      <div className="relative z-10 flex min-h-[100dvh] flex-col">
        <Navbar isAuthenticated={isAuthenticated} />

        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-20 pt-10">
          <div className="flex flex-col items-center gap-8">
            {/* Badge */}
            <motion.div
              className="flex items-center gap-2 rounded-[20px] px-4 py-2 text-[13px] font-medium"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT }}
            >
              <motion.span
                className="size-[5px] rounded-full bg-green-400"
                animate={reduce ? undefined : { opacity: [1, 0.3, 1], scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <span className="text-white/60">{t('poweredBy')}</span>
              <span className="text-white">{t('geminiAi')}</span>
            </motion.div>

            {/* Heading — word stagger */}
            <motion.h1
              className="max-w-[760px] text-center text-[36px] font-medium leading-[1.18] text-white md:text-[56px]"
              variants={reduce ? undefined : container}
              initial={reduce ? false : 'hidden'}
              animate={reduce ? undefined : 'show'}
            >
              {words.map((word, i) => (
                <motion.span
                  key={`${word}-${i}`}
                  className="mr-[0.25em] inline-block"
                  variants={reduce ? undefined : item}
                >
                  {word}
                </motion.span>
              ))}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              className="max-w-[620px] text-center text-[15px] font-normal text-white/70"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.5, ease: EASE_OUT }}
            >
              {t('subtitle')}
            </motion.p>

            {/* CTAs */}
            <motion.div
              className="flex flex-col items-center gap-3 sm:flex-row"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.65, ease: EASE_OUT }}
            >
              <Magnetic>
                <GlowPillButton
                  label={t('ctaQuizBuilder')}
                  variant="light"
                  href={isAuthenticated ? '/create' : '/register?next=/create'}
                />
              </Magnetic>
              <Magnetic>
                <GlowPillButton
                  label={t('ctaAdaptiveLearning')}
                  variant="dark"
                  href={isAuthenticated ? '/adaptive' : '/register?next=/adaptive'}
                />
              </Magnetic>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
