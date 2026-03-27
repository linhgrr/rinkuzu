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
                {t('main.content')}
              </p>

              <div className="flex items-center justify-center gap-4">
                <button
                  className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-white"
                  aria-label="Previous testimonial"
                >
                  <HiOutlineChevronLeft className="w-6 h-6" aria-hidden="true" />
                </button>
                <button
                  className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-white"
                  aria-label="Next testimonial"
                >
                  <HiOutlineChevronRight className="w-6 h-6" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Background decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-[100px]" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/20 rounded-full blur-[100px]" />
          </div>

          {/* User Photos Grid — using Unsplash (already whitelisted in next.config.js) */}
          <div className="flex-1 grid grid-cols-2 gap-4">
            {[
              { name: 'Student from Hanoi University', url: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=400&q=80' },
              { name: 'Teacher using RinKuzu', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80' },
              { name: 'Self-learner using RinKuzu', url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80' },
              { name: 'Course creator on RinKuzu', url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80' },
            ].map((user) => (
              <div key={user.name} className="relative aspect-square rounded-3xl overflow-hidden group">
                <Image
                  src={user.url}
                  alt={user.name}
                  fill
                  className="object-cover group-hover:scale-110 transition-transform duration-500"
                  sizes="(max-width: 1024px) 50vw, 200px"
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
