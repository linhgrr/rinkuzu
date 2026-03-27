'use client'

import { useTranslations } from 'next-intl'
import { HiOutlineUserAdd, HiOutlineCloudUpload, HiOutlineAcademicCap, HiOutlineLogin } from '@/components/icons'
import { JsonLd } from '@/components/seo/JsonLd'
import Image from 'next/image'

// HowTo schema deprecated per Google's guidelines for SaaS/web apps.
// Replacing with WebApplication schema which better represents a web-based service.
// See: https://developers.google.com/search/docs/appearance/structured-data/softwareapp
const webApplicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'RinKuzu — AI Adaptive Learning Platform',
  description:
    'Transform any PDF into a personalized adaptive quiz journey. Uses knowledge graphs, SAINT-Bloom knowledge tracing, and Dueling DQN curriculum sequencing.',
  url: 'https://www.rinkuzu.app',
  applicationCategory: 'EducationApplication',
  operatingSystem: 'Web',
  browserRequirements: 'Requires a modern web browser. Works on desktop, tablet, and mobile.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    availability: 'https://schema.org/IsAccessibleForFree',
    url: 'https://www.rinkuzu.app/pricing',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '247',
    bestRating: '5',
    worstRating: '1',
  },
  screenshot: {
    '@type': 'ImageObject',
    url: 'https://images.unsplash.com/photo-1589998059171-988d887df646?w=1200&q=80',
    width: 1200,
    height: 630,
  },
};

export function HowItWorks() {
  const t = useTranslations('landing.howItWorks')

  return (
    <>
      <JsonLd id="webapp-schema" data={webApplicationSchema} />
    <section className="py-16 md:py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-20">
          {/* Left: Steps with Numbers */}
          <div className="flex-1 space-y-8 w-full">
            <h2 className="text-4xl md:text-6xl font-bold text-[#1e242c] mb-10 md:mb-16 text-center lg:text-left">
              {t('title')}
            </h2>

            <div className="space-y-6 md:space-y-8">
              {/* Step 01 */}
              <div className="flex items-center gap-4 md:gap-6">
                <span className="text-6xl md:text-[100px] font-bold text-[#002b6b] opacity-10 leading-none select-none min-w-[1.2em]">01</span>
                <div className="flex-1 bg-white border border-[#edeef0] p-4 md:p-6 rounded-[24px] shadow-[10px_25px_100px_0px_rgba(0,43,107,0.15)] flex items-center gap-4">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#e1e9fe] flex items-center justify-center shrink-0">
                    <HiOutlineUserAdd className="w-5 h-5 md:w-6 md:h-6 text-[#0066ff]" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-lg md:text-xl font-bold text-[#1e242c]">{t('step1.title')}</h3>
                    <p className="text-[#414d60] text-xs md:text-sm mt-1">{t('step1.description')}</p>
                  </div>
                </div>
              </div>

              {/* Step 02 - Responsive alignment */}
              <div className="flex items-center gap-4 md:gap-6 lg:flex-row-reverse">
                <span className="lg:hidden text-6xl font-bold text-[#002b6b] opacity-10 leading-none select-none min-w-[1.2em]">02</span>
                <div className="flex-1 bg-white border border-[#edeef0] p-4 md:p-6 rounded-[24px] shadow-[10px_25px_100px_0px_rgba(0,43,107,0.15)] flex items-center gap-4">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#ffeed2] flex items-center justify-center shrink-0">
                    <HiOutlineCloudUpload className="w-5 h-5 md:w-6 md:h-6 text-[#ff9900]" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-lg md:text-xl font-bold text-[#1e242c]">{t('step2.title')}</h3>
                    <p className="text-[#414d60] text-xs md:text-sm mt-1">{t('step2.description')}</p>
                  </div>
                </div>
                <span className="hidden lg:block text-[100px] font-bold text-[#002b6b] opacity-10 leading-none select-none min-w-[1.2em]">02</span>
              </div>

              {/* Step 03 */}
              <div className="flex items-center gap-4 md:gap-6">
                <span className="text-6xl md:text-[100px] font-bold text-[#002b6b] opacity-10 leading-none select-none min-w-[1.2em]">03</span>
                <div className="flex-1 bg-white border border-[#edeef0] p-4 md:p-6 rounded-[24px] shadow-[10px_25px_100px_0px_rgba(0,43,107,0.15)] flex items-center gap-4">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#f6e2ff] flex items-center justify-center shrink-0">
                    <HiOutlineAcademicCap className="w-5 h-5 md:w-6 md:h-6 text-[#af52de]" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-lg md:text-xl font-bold text-[#1e242c]">{t('step3.title')}</h3>
                    <p className="text-[#414d60] text-xs md:text-sm mt-1">{t('step3.description')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Illustration Grid (Hidden on Mobile) */}
          <div className="hidden lg:block flex-1 relative h-[600px] w-full max-w-[600px]">
            <div className="absolute top-0 right-0 w-[60%] h-[80%] rounded-[32px] overflow-hidden shadow-apple-2xl">
              <Image
                src="https://picsum.photos/seed/learn1/800/1000"
                alt="Learning process"
                fill
                className="object-cover"
              />
            </div>

            <div className="absolute top-0 left-0 w-[38%] h-[55%] rounded-[32px] overflow-hidden shadow-apple-xl">
              <Image
                src="https://picsum.photos/seed/learn2/500/700"
                alt="Student studying"
                fill
                className="object-cover"
              />
            </div>

            <div className="absolute bottom-[10%] left-0 bg-white border border-[#edeef0] p-4 rounded-[24px] shadow-[10px_25px_100px_0px_rgba(0,43,107,0.15)] flex items-center gap-4 z-20">
              <div className="flex -space-x-3 items-center pr-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-12 h-12 rounded-full border-2 border-white overflow-hidden bg-gray-100">
                    <Image src={`https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=100&q=80`} alt="Student using RinKuzu" width={48} height={48} className="w-12 h-12 rounded-full object-cover" />
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xl font-bold text-[#0066ff]">10K +</p>
                <p className="text-xs font-semibold text-[#414d60]">Students</p>
              </div>
            </div>

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-blue-50/30 rounded-full blur-[120px] -z-10" />
          </div>
        </div>
      </div>
    </section>
    </>
  )
}
