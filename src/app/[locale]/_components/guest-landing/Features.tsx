'use client'

import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { HiOutlineDocumentText, HiOutlineLightningBolt, HiOutlineChartBar, HiOutlinePlay, HiOutlineUsers } from '@/components/icons'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { ROUTES } from '@/shared/constants'

const chatbotIcon = 'https://i.ibb.co/ZRYgc1tN/Gemini-Generated-Image-yjm06yyjm06yyjm0-removebg-preview.png'

export function Features () {
  const t = useTranslations('landing.features')
  const router = useRouter()

  const handleStart = useCallback(() => {
    router.push(ROUTES.REGISTER)
  }, [router])

  return (
    <section className="py-24 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-20 max-w-2xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-bold text-[#1e242c] mb-6">
            {t('title')}
          </h2>
          <p className="text-[#414d60] text-lg leading-relaxed">
            {t('subtitle')}
          </p>
        </div>

        {/* Central Illustration with Circles and Cards */}
        <div className="relative w-full max-w-[900px] aspect-square mx-auto flex items-center justify-center">
          
          {/* Decorative Circles from Design */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[100%] aspect-square rounded-full border border-blue-50/50" />
            <div className="absolute w-[85%] aspect-square rounded-full border border-blue-50" />
            <div className="absolute w-[65%] aspect-square rounded-full border border-blue-100/50" />
            <div className="absolute w-[45%] aspect-square rounded-full border border-blue-100" />
          </div>

          {/* Center Content: Rin-chan / Learning Experience */}
          <div className="relative w-[40%] h-[85%] z-20 rounded-[32px] overflow-hidden shadow-apple-2xl border-4 border-white">
            <Image 
              src="https://i.ibb.co/chDwCJ84/image.png" 
              alt="Rin-chan Rin-chan"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-blue-600/80 via-transparent to-transparent flex flex-col justify-end p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto mb-4 border border-white/30 group cursor-pointer hover:scale-110 transition-transform">
                <HiOutlinePlay className="w-6 h-6 text-white fill-current" />
              </div>
              <p className="text-white font-bold text-xl uppercase tracking-wider">{t('aiTutor')}</p>
            </div>
          </div>

          {/* Floating Cards - Left Side */}
          {/* Feature 1: Instant Quiz */}
          <div className="absolute left-[-5%] top-[25%] z-30 w-[32%] animate-float-slow">
            <Card className="p-6 border border-[#edeef0] shadow-[10px_25px_100px_0px_rgba(0,43,107,0.15)] rounded-[24px] text-center bg-white/95 backdrop-blur-sm">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 shadow-apple-sm flex items-center justify-center mx-auto mb-4 text-blue-600">
                <HiOutlineDocumentText className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-[#1e242c] text-lg mb-2">{t('feature1.title')}</h4>
              <p className="text-[#414d60] text-xs mb-6 line-clamp-2">{t('feature1.description')}</p>
              <Button onClick={handleStart} size="sm" className="rounded-full bg-[#0066ff] text-white px-6">{t('feature1.button')}</Button>
            </Card>
          </div>

          {/* User Stats Card */}
          <div className="absolute left-[0%] bottom-[20%] z-30 w-[30%] animate-float-slow" style={{ animationDelay: '1s' }}>
            <Card className="p-5 border border-[#edeef0] shadow-[10px_25px_100px_0px_rgba(0,43,107,0.15)] rounded-[20px] bg-white/95 backdrop-blur-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-50 shadow-apple-sm flex items-center justify-center shrink-0 text-green-600">
                <HiOutlineUsers className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-[#1e242c] text-lg">50K +</p>
                <p className="text-[#414d60] text-[10px] leading-tight font-medium uppercase tracking-wider">{t('stats.activeUsers')}</p>
              </div>
            </Card>
          </div>

          {/* Floating Cards - Right Side */}
          {/* Feature 2: 24/7 Rin-chan */}
          <div className="absolute right-[0%] top-[15%] z-30 w-[28%] animate-bounce-slow">
            <Card className="p-4 border border-[#edeef0] shadow-[10px_25px_100px_0px_rgba(0,43,107,0.15)] rounded-[20px] flex items-center gap-4 bg-white/95 backdrop-blur-sm">
              <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                <Image src={chatbotIcon} alt="AI chatbot" width={24} height={24} className="w-6 h-6" />
              </div>
              <p className="font-bold text-[#1e242c] text-base leading-tight">{t('feature2.title')}</p>
            </Card>
          </div>

          {/* Feature 3: Adaptive Learning */}
          <div className="absolute right-[-5%] bottom-[30%] z-30 w-[32%] animate-bounce-slow" style={{ animationDelay: '1.5s' }}>
            <Card className="p-6 border border-[#edeef0] shadow-[10px_25px_100px_0px_rgba(0,43,107,0.15)] rounded-[24px] text-center bg-white/95 backdrop-blur-sm">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 shadow-apple-sm flex items-center justify-center mx-auto mb-4 text-orange-600">
                <HiOutlineLightningBolt className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-[#1e242c] text-lg mb-2">{t('feature3.title')}</h4>
              <p className="text-[#414d60] text-xs mb-6 line-clamp-2">{t('feature3.description')}</p>
              <Button onClick={handleStart} size="sm" className="rounded-full bg-[#0066ff] text-white px-6">{t('feature3.button')}</Button>
            </Card>
          </div>

          {/* Feature 4: Progress Analytics (Small card overlay) */}
          <div className="absolute right-[10%] bottom-[10%] z-40 w-[25%] animate-pulse-slow">
            <Card className="p-4 border border-[#edeef0] shadow-apple-lg rounded-[20px] bg-white/95 backdrop-blur-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0 text-blue-600">
                <HiOutlineChartBar className="w-5 h-5" />
              </div>
              <span className="font-bold text-[#1e242c] text-xs">{t('feature4.title')}</span>
            </Card>
          </div>

          {/* Decorative Arrows from Design */}
          <div className="absolute top-[10%] right-[15%] w-16 h-16 rotate-[15deg] opacity-40 select-none pointer-events-none">
            <svg viewBox="0 0 75 47" fill="none" className="w-full h-full text-[#002b6b]">
              <path d="M1 45C10 30 30 10 70 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M60 15L72 5L62 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="absolute bottom-[10%] left-[15%] w-20 h-20 -rotate-[20deg] opacity-40 select-none pointer-events-none">
            <svg viewBox="0 0 95 65" fill="none" className="w-full h-full text-[#002b6b]">
              <path d="M90 5C80 25 50 55 5 60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M15 50L5 60L20 63" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

        </div>
      </div>
    </section>
  )
}
