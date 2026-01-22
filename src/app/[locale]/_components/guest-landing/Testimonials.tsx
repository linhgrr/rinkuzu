'use client'

import { useTranslations } from 'next-intl'
import { HiOutlineChevronLeft, HiOutlineChevronRight } from '@/components/icons'
import Image from 'next/image'

export function Testimonials() {
  const t = useTranslations('landing.testimonials')

  return (
    <section className="py-16 md:py-24 bg-[#fafafa]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl md:text-5xl font-bold text-[#1e242c] mb-10 md:mb-16 text-center lg:text-left">
          {t('title')}
        </h2>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Testimonial Card */}
          <div className="flex-[1.5] bg-[#1d1d1f] rounded-3xl p-8 md:p-16 text-white relative overflow-hidden flex flex-col items-center justify-center text-center">
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-3 mb-10">
                <span className="font-bold text-xl">{t('main.name')}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span className="text-gray-400">{t('main.role')}</span>
              </div>

              <p className="text-2xl md:text-3xl font-medium leading-relaxed mb-12 italic">
                "{t('main.content')}"
              </p>

              <div className="flex items-center justify-center gap-4">
                <button className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
                  <HiOutlineChevronLeft className="w-6 h-6" />
                </button>
                <button className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
                  <HiOutlineChevronRight className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Background decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-[100px]" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/20 rounded-full blur-[100px]" />
          </div>

          {/* User Photos Grid */}
          <div className="flex-1 grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="relative aspect-square rounded-3xl overflow-hidden group">
                <Image
                  src={`https://i.pravatar.cc/300?u=user${i}`}
                  alt="Reviewer"
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
