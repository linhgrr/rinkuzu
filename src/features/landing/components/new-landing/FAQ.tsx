'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { HiOutlinePlus } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { Reveal, EASE_OUT } from './motion-primitives';

function splitAnswerLead(text: string): { lead: string; rest: string } {
  const normalized = text.trim();
  const endOfLead = normalized.search(/[.!?]\s/);
  if (endOfLead === -1) {
    return { lead: normalized, rest: '' };
  }

  const splitIndex = endOfLead + 1;
  return {
    lead: normalized.slice(0, splitIndex).trim(),
    rest: normalized.slice(splitIndex).trim(),
  };
}

export function FAQ() {
  const t = useTranslations('landing.faq');
  const reduce = useReducedMotion();
  const [openId, setOpenId] = useState<string | null>('1');

  const faqs: { id: string; q: string; a: string }[] = [];
  for (let i = 1; i <= 15; i++) {
    const q = t.raw(`q${i}`) as string | undefined;
    const a = t.raw(`a${i}`) as string | undefined;
    if (q && a) {
      faqs.push({ id: String(i), q, a });
    }
  }

  if (faqs.length === 0) return null;

  return (
    <section className="bg-[#0d0d0d] py-24 md:py-32">
      <div className="mx-auto max-w-3xl px-6">
        <Reveal className="mb-12 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            {t('title')}
          </h2>
        </Reveal>

        <div className="space-y-3">
          {faqs.map((faq) => {
            const isOpen = openId === faq.id;
            return (
              <div
                key={faq.id}
                className={`overflow-hidden rounded-xl border transition-colors ${
                  isOpen ? 'border-green-500/30 bg-green-500/5' : 'border-white/10 bg-white/5'
                }`}
              >
                <Button
                  type="button"
                  variant="ghost"
                  className="flex w-full items-center justify-between px-6 py-4 text-left text-white hover:bg-transparent"
                  onClick={() => setOpenId(isOpen ? null : faq.id)}
                  aria-expanded={isOpen}
                >
                  <span className="whitespace-normal pr-4 text-left font-medium text-white">
                    {faq.q}
                  </span>
                  <motion.span
                    className="shrink-0 text-green-400"
                    animate={{ rotate: isOpen ? 135 : 0 }}
                    transition={{ duration: 0.3, ease: EASE_OUT }}
                  >
                    <HiOutlinePlus className="size-5" aria-hidden="true" />
                  </motion.span>
                </Button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={reduce ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: EASE_OUT }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-4 text-sm leading-relaxed text-white/60">
                        {(() => {
                          const { lead, rest } = splitAnswerLead(faq.a);
                          return (
                            <>
                              <p className="text-white/85">{lead}</p>
                              {rest ? <p className="mt-2">{rest}</p> : null}
                            </>
                          );
                        })()}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
