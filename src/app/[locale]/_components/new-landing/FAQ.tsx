'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { HiOutlinePlus, HiOutlineMinus } from '@/components/icons';

export function FAQ() {
  const t = useTranslations('landing.faq');
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
    <section className="bg-[#0d0d0d] py-24">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{t('title')}</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq) => (
            <div
              key={faq.id}
              className={`rounded-xl border transition-all ${
                openId === faq.id
                  ? 'border-brand-trust/30 bg-green-500/5'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              <button
                className="w-full px-6 py-4 flex items-center justify-between text-left"
                onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                aria-expanded={openId === faq.id}
              >
                <span className="text-white font-medium pr-4">{faq.q}</span>
                <span className="text-green-400 shrink-0">
                  {openId === faq.id ? (
                    <HiOutlineMinus className="w-5 h-5" />
                  ) : (
                    <HiOutlinePlus className="w-5 h-5" />
                  )}
                </span>
              </button>
              {openId === faq.id && (
                <div className="px-6 pb-4 text-white/60 text-sm leading-relaxed">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
