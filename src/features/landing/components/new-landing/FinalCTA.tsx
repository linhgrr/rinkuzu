'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion, useReducedMotion } from 'framer-motion';
import { Magnetic, Reveal, EASE_OUT } from './motion-primitives';

export function FinalCTA() {
  const t = useTranslations('landing');
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-[#07121a] py-28 md:py-36">
      {/* animated glow */}
      {!reduce && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 size-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[150px]"
          style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.18), transparent 70%)' }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <Reveal>
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">
            {t('ready_to_start')}
          </h2>
        </Reveal>
        <motion.div
          className="mt-10 flex flex-wrap justify-center gap-4"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7, delay: 0.1, ease: EASE_OUT }}
        >
          <Magnetic>
            <Link
              href="/adaptive"
              className="inline-flex items-center justify-center rounded-full bg-white px-8 py-4 text-lg font-semibold text-black transition-colors duration-200 hover:bg-neutral-100"
            >
              {t('get_started_free')}
            </Link>
          </Magnetic>
          <Magnetic>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center rounded-full border border-neutral-700 bg-transparent px-8 py-4 text-lg font-semibold text-white transition-colors duration-200 hover:bg-neutral-800"
            >
              {t('view_pricing')}
            </Link>
          </Magnetic>
        </motion.div>
      </div>
    </section>
  );
}
