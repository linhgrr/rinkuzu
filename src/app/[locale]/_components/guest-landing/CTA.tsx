'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/shared/constants'
import { HiOutlineMail } from '@/components/icons'
import Image from 'next/image'

export function CTA() {
  const t = useTranslations('landing.cta')
  const router = useRouter()
  const [email, setEmail] = useState('')

  const handleJoin = useCallback(() => {
    // If there's an email, we could pass it to register page
    router.push(`${ROUTES.REGISTER}${email ? `?email=${encodeURIComponent(email)}` : ''}`)
  }, [router, email])

  return (
    <section className="py-16 md:py-24 px-4">
      <div className="max-w-7xl mx-auto relative rounded-[32px] md:rounded-[48px] overflow-hidden bg-[#fafafa] p-6 md:p-20 text-center border border-gray-100 shadow-[0px_16px_40px_0px_rgba(57,29,232,0.08)]">
        {/* Background Decorative Gradients from Design */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
          <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[140%] bg-purple-100/40 rounded-full blur-[120px]" />
          <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[140%] bg-blue-100/30 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold text-[#1e242c] mb-6 tracking-tight">
            {t('title')}
          </h2>
          <p className="text-[#414d60] text-base md:text-lg mb-8 md:mb-12 leading-relaxed max-w-2xl mx-auto">
            {t('subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center max-w-xl mx-auto">
            <div className="relative flex-1 w-full group">
              <div className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors">
                <HiOutlineMail className="w-6 h-6" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('placeholder')}
                className="w-full bg-white border border-[#ededed] rounded-full pl-16 pr-6 py-5 text-gray-700 shadow-[8px_8px_56px_0px_rgba(0,0,0,0.05)] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
              />
            </div>
            <Button
              onClick={handleJoin}
              size="lg"
              className="w-full sm:w-auto rounded-full px-10 py-5 h-auto text-base font-bold bg-[#0066ff] hover:bg-blue-700 shadow-apple-lg transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
            >
              {t('button')}
            </Button>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-gray-400 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {t('freeTrial')}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              {t('noCreditCard')}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              {t('aiSupport')}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
