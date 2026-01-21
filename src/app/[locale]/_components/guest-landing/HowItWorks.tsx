'use client'

import { useTranslations } from 'next-intl'
import { HiOutlineUserAdd, HiOutlineCloudUpload, HiOutlineAcademicCap, HiOutlineLogin } from '@/components/icons'
import Image from 'next/image'

export function HowItWorks () {
  const t = useTranslations('landing.howItWorks')

  return (
    <section className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-20">
          {/* Left: Steps with Numbers */}
          <div className="flex-1 space-y-8 w-full">
            <h2 className="text-5xl md:text-6xl font-bold text-[#1e242c] mb-16">
              {t('title')}
            </h2>
            
            <div className="space-y-6">
              {/* Step 01 */}
              <div className="flex items-center gap-6">
                <span className="text-[100px] font-bold text-[#002b6b] opacity-10 leading-none select-none">01</span>
                <div className="flex-1 bg-white border border-[#edeef0] p-6 rounded-[24px] shadow-[10px_25px_100px_0px_rgba(0,43,107,0.15)] flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-[#e1e9fe] flex items-center justify-center shrink-0">
                    <HiOutlineUserAdd className="w-6 h-6 text-[#0066ff]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#1e242c]">{t('step1.title')}</h3>
                    <p className="text-[#414d60] text-sm mt-1">{t('step1.description')}</p>
                  </div>
                </div>
              </div>

              {/* Step 02 - Reversed layout */}
              <div className="flex items-center gap-6">
                <div className="flex-1 bg-white border border-[#edeef0] p-6 rounded-[24px] shadow-[10px_25px_100px_0px_rgba(0,43,107,0.15)] flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-[#ffeed2] flex items-center justify-center shrink-0">
                    <HiOutlineCloudUpload className="w-6 h-6 text-[#ff9900]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#1e242c]">{t('step2.title')}</h3>
                    <p className="text-[#414d60] text-sm mt-1">{t('step2.description')}</p>
                  </div>
                </div>
                <span className="text-[100px] font-bold text-[#002b6b] opacity-10 leading-none select-none">02</span>
              </div>

              {/* Step 03 */}
              <div className="flex items-center gap-6">
                <span className="text-[100px] font-bold text-[#002b6b] opacity-10 leading-none select-none">03</span>
                <div className="flex-1 bg-white border border-[#edeef0] p-6 rounded-[24px] shadow-[10px_25px_100px_0px_rgba(0,43,107,0.15)] flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-[#f6e2ff] flex items-center justify-center shrink-0">
                    <HiOutlineAcademicCap className="w-6 h-6 text-[#af52de]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#1e242c]">{t('step3.title')}</h3>
                    <p className="text-[#414d60] text-sm mt-1">{t('step3.description')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Illustration Grid */}
          <div className="flex-1 relative h-[600px] w-full max-w-[600px]">
            {/* Main Image 1 */}
            <div className="absolute top-0 right-0 w-[60%] h-[80%] rounded-[32px] overflow-hidden shadow-apple-2xl">
              <Image 
                src="https://picsum.photos/seed/learn1/800/1000" 
                alt="Learning process"
                fill
                className="object-cover"
              />
            </div>
            
            {/* Main Image 2 */}
            <div className="absolute top-0 left-0 w-[38%] h-[55%] rounded-[32px] overflow-hidden shadow-apple-xl">
              <Image 
                src="https://picsum.photos/seed/learn2/500/700" 
                alt="Student studying"
                fill
                className="object-cover"
              />
            </div>
            
            {/* Floating Stats Card */}
            <div className="absolute bottom-[10%] left-0 bg-white border border-[#edeef0] p-4 rounded-[24px] shadow-[10px_25px_100px_0px_rgba(0,43,107,0.15)] flex items-center gap-4 z-20">
              <div className="flex -space-x-3 items-center pr-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-12 h-12 rounded-full border-2 border-white overflow-hidden bg-gray-100">
                    <Image src={`https://i.pravatar.cc/100?u=how${i}`} alt="User" width={48} height={48} />
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xl font-bold text-[#0066ff]">10K +</p>
                <p className="text-xs font-semibold text-[#414d60]">Students</p>
              </div>
            </div>
            
            {/* Decorative background blur */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-blue-50/30 rounded-full blur-[120px] -z-10" />
          </div>
        </div>
      </div>
    </section>
  )
}
