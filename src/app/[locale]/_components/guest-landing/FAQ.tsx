'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { HiOutlinePlus, HiOutlineMinus } from '@/components/icons'

export function FAQ () {
  const t = useTranslations('landing.faq')
  const [openId, setOpenId] = useState<string | null>('01')

  const faqs = [
    {
      id: '01',
      question: t('q1'),
      answer: t('a1')
    },
    {
      id: '02',
      question: t('q2'),
      answer: t('a2')
    },
    {
      id: '03',
      question: t('q3'),
      answer: t('a3')
    },
    {
      id: '04',
      question: t('q4'),
      answer: t('a4')
    }
  ]

  return (
    <section className="py-24 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-4xl md:text-5xl font-bold text-[#1e242c] mb-16 text-center">
          {t('title')}
        </h2>
        
        <div className="space-y-4">
          {faqs.map((faq) => (
            <div 
              key={faq.id} 
              className={`rounded-3xl border transition-all ${openId === faq.id ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100 bg-white'}`}
            >
              <button
                className="w-full px-8 py-6 flex items-center justify-between text-left focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:rounded-3xl"
                onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                aria-expanded={openId === faq.id}
              >
                <span className="text-lg font-bold text-[#1e242c]">{faq.question}</span>
                <div className={`flex-none w-10 h-10 rounded-full flex items-center justify-center transition-colors ${openId === faq.id ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-400'}`}>
                  {openId === faq.id ? (
                    <HiOutlineMinus className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <HiOutlinePlus className="w-5 h-5" aria-hidden="true" />
                  )}
                </div>
              </button>
              
              <div className={`overflow-hidden transition-all duration-300 ${openId === faq.id ? 'max-h-96' : 'max-h-0'}`}>
                <div className="px-8 pb-8 text-gray-500 leading-relaxed">
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
