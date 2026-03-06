'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/shared/constants'
import { HiOutlineArrowRight, HiOutlineSearch, HiOutlineLocationMarker } from '@/components/icons'
import { IntroVideo } from './IntroVideo'

const Hero3DScene = dynamic(() => import('./Hero3DScene').then(mod => mod.Hero3DScene), { ssr: false })

export function Hero() {
  const t = useTranslations('landing.hero')
  const router = useRouter()

  const handleGetStarted = useCallback(() => {
    router.push(ROUTES.REGISTER)
  }, [router])

  return (
    <section className="relative w-full bg-white overflow-hidden pt-12 pb-16 md:pt-32 md:pb-32">
      {/* Background Gradient & 3D Scene */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[140%] h-[100%] bg-[radial-gradient(circle_at_top,_#e0e7ff_0%,_transparent_50%)] opacity-40 mix-blend-multiply" />
        <div className="absolute top-[-10%] left-[10%] sm:left-[20%] w-[40%] sm:w-[30%] h-[40%] bg-[#818cf8] opacity-20 blur-[80px] sm:blur-[120px] rounded-full" />
        <div className="absolute top-[-10%] right-[10%] sm:right-[20%] w-[40%] sm:w-[30%] h-[40%] bg-[#c084fc] opacity-20 blur-[80px] sm:blur-[120px] rounded-full" />

        {/* Interactive 3D Background */}
        <Hero3DScene />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center z-10">
        {/* Top Chip */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-full shadow-apple-sm mb-6 md:mb-8 animate-fadeIn">
          <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-sm font-medium text-gray-600">
            {t('badge')}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-7xl font-bold text-[#1d1d1f] tracking-tight mb-6 leading-[1.2] md:leading-[1.1] animate-fadeInUp">
          {t('titlePart1')}<br className="hidden sm:block" />
          <span className="text-blue-600">{t('titlePart2')}</span>
        </h1>

        {/* Description */}
        <p className="text-base md:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed animate-fadeInUp delay-100">
          {t('description')}
        </p>

        {/* Search/Input Area - Adapted from Figma */}
        <div className="max-w-3xl mx-auto mb-12 md:mb-16 animate-fadeInUp delay-200">
          <div className="flex flex-col sm:flex-row items-center bg-white p-1.5 sm:p-2 rounded-[28px] sm:rounded-full shadow-apple-lg border border-gray-100 gap-1 sm:gap-2">
            <div className="flex-1 flex items-center gap-3 px-5 py-3 w-full border-b sm:border-b-0 sm:border-r border-gray-100">
              <HiOutlineSearch className="w-5 h-5 text-gray-400" aria-hidden="true" />
              <input
                type="text"
                name="search"
                placeholder={t('searchPlaceholder')}
                aria-label={t('searchPlaceholder')}
                className="w-full bg-transparent border-none focus:ring-0 text-gray-700 placeholder:text-gray-400 text-sm md:text-base"
              />
            </div>
            <div className="flex-1 hidden md:flex items-center gap-3 px-6 py-3 w-full">
              <HiOutlineLocationMarker className="w-5 h-5 text-gray-400" aria-hidden="true" />
              <span className="text-gray-400 text-sm">{t('community')}</span>
            </div>
            <Button size="lg" className="w-full sm:w-auto rounded-full px-8 py-4 md:py-6 h-auto text-base focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
              {t('searchButton')}
            </Button>
          </div>
        </div>

        {/* Intro Video Section */}
        <IntroVideo />
      </div>
    </section>
  )
}

