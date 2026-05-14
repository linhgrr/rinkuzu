'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { HiOutlinePlus, HiOutlineMinus } from '@/components/icons';
import { Button } from '@/components/ui/Button';

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
          <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">{t('title')}</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq) => (
            <div
              key={faq.id}
              className={`rounded-xl border transition-colors ${
                openId === faq.id
                  ? 'border-brand-trust/30 bg-green-500/5'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              <Button
                type="button"
                variant="ghost"
                className="flex w-full items-center justify-between px-6 py-4 text-left text-white hover:bg-transparent"
                onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                aria-expanded={openId === faq.id}
              >
                <span className="text-white font-medium pr-4 whitespace-normal text-left">
                  {faq.q}
                </span>
                <span className="text-green-400 shrink-0">
                  {openId === faq.id ? (
                    <HiOutlineMinus className="size-5" aria-hidden="true" />
                  ) : (
                    <HiOutlinePlus className="size-5" aria-hidden="true" />
                  )}
                </span>
              </Button>
              {openId === faq.id && (
                <div className="px-6 pb-4 text-white/60 text-sm leading-relaxed">
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
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
